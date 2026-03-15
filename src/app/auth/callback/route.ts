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
            console.error('OAuth code exchange error:', error.message);
            return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent('로그인에 실패했습니다. 다시 시도해주세요.')}`);
        }
    } else {
        console.error('OAuth callback error:', searchParams.get('error_description') || searchParams.get('error'));
        return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent('소셜 로그인에 실패했습니다. 다시 시도해주세요.')}`);
    }

    // Success! Redirect to the destination
    return NextResponse.redirect(`${origin}${safeNext}`);
}
