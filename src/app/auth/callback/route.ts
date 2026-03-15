import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get('code');
    const next = searchParams.get('next') ?? '/';

    // [SEC-09] Open Redirect Protection
    const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/';

    if (code) {
        const supabase = await createClient();
        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) {
            return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`);
        }
    } else {
        const errorMsg = searchParams.get('error_description') || searchParams.get('error') || '인증에 실패했습니다.';
        return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(errorMsg)}`);
    }

    // Default error fallback
    return NextResponse.redirect(`${origin}/login?error=unknown_error`);
}
