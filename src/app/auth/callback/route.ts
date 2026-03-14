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

        if (!error) {
            const forwardedHost = request.headers.get('x-forwarded-host');
            const isLocalEnv = process.env.NODE_ENV === 'development';

            if (isLocalEnv) {
                return NextResponse.redirect(`${origin}${safeNext}`);
            } else if (forwardedHost) {
                return NextResponse.redirect(`https://${forwardedHost}${safeNext}`);
            }
            return NextResponse.redirect(`${origin}${safeNext}`);
        }
    }

    // return the user to an error page with instructions
    return NextResponse.redirect(`${origin}/login?error=true`);
}
