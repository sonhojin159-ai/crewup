import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { DISCLAIMERS, ConsentType } from '@/lib/disclaimers';
import { rateLimitByUser } from '@/lib/rateLimit';

export async function POST(request: Request) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { success } = rateLimitByUser(user.id, 'consent', 20, 60_000);
    if (!success) {
        return NextResponse.json({ error: '요청이 너무 많습니다.' }, { status: 429 });
    }

    try {
        const body = await request.json();
        const { consentType, crewId } = body as { consentType: ConsentType; crewId?: string };

        if (!consentType || !DISCLAIMERS[consentType]) {
            return NextResponse.json({ error: '유효하지 않은 동의 유형입니다.' }, { status: 400 });
        }

        const userAgent = request.headers.get('user-agent') || '';
        const forwardedFor = request.headers.get('x-forwarded-for');
        const ip = forwardedFor?.split(',')[0]?.trim() || 'unknown';

        const { error } = await supabase.from('consent_logs').insert({
            user_id: user.id,
            consent_type: consentType,
            consent_text: DISCLAIMERS[consentType],
            crew_id: crewId || null,
            ip_address: ip,
            user_agent: userAgent,
        });

        if (error) {
            console.error('Consent log error:', error);
            return NextResponse.json({ error: '동의 기록 저장에 실패했습니다.' }, { status: 500 });
        }

        return NextResponse.json({ success: true }, { status: 201 });
    } catch (error: unknown) {
        console.error('Consent API error:', error);
        return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
    }
}
