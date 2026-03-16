import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { rateLimitByUser } from '@/lib/rateLimit';

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const resolvedParams = await params;
    const crewId = resolvedParams.id;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: '인증되지 않은 요청입니다.' }, { status: 401 });
    }

    // Rate Limiting: 참여 신청은 분당 5회로 제한
    const { success: rlSuccess } = rateLimitByUser(user.id, 'crew-join', 5, 60_000);
    if (!rlSuccess) {
        return NextResponse.json({ error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' }, { status: 429 });
    }

    // 블랙리스트 체크
    const { data: blacklisted } = await supabase
        .from('blacklist')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

    if (blacklisted) {
        return NextResponse.json({ error: '제재된 계정으로는 크루에 참여할 수 없습니다.' }, { status: 403 });
    }

    try {
        // 1. Check if the crew exists and count current active members
        const { data: crewData, error: crewError } = await supabase
            .from('crews')
            .select('max_members, created_by, entry_points, deposit, crew_members(count)')
            .eq('id', crewId)
            .eq('crew_members.status', 'active')
            .single();

        if (crewError || !crewData) {
            return NextResponse.json({ error: '크루를 찾을 수 없습니다.' }, { status: 404 });
        }

        if (crewData.created_by === user.id) {
            return NextResponse.json({ error: '크루장은 참여 신청할 수 없습니다.' }, { status: 400 });
        }

        const activeCount = crewData.crew_members[0]?.count || 0;
        if (activeCount >= crewData.max_members) {
            return NextResponse.json({ error: '크루 정원이 마감되었습니다.' }, { status: 400 });
        }

        // 2. Check if user already applied
        const { data: existingMember } = await supabase
            .from('crew_members')
            .select('status')
            .eq('crew_id', crewId)
            .eq('user_id', user.id)
            .maybeSingle();

        if (existingMember) {
            if (existingMember.status === 'rejected') {
                return NextResponse.json({ error: '크루장에 의해 반려된 신청입니다. 해당 크루에 재신청할 수 없습니다.' }, { status: 403 });
            }
            return NextResponse.json({ error: '이미 참여 신청했거나 활동 중인 크루입니다.' }, { status: 400 });
        }

        // 3. Insert pending request
        const { error: insertError } = await supabase
            .from('crew_members')
            .insert({
                crew_id: crewId,
                user_id: user.id,
                status: 'pending',
                payment_status: 'unpaid'
            });

        if (insertError) throw insertError;

        // 참고: 참여금(entry_points) 및 예치금(deposit) 결제는 크루장이 가입 승인 시 호출되는 
        // process_entry_payment 함수(또는 유사 로직)에서 처리되는 것으로 설계됨.
        // 여기서는 가입 신청 단계이므로 status: pending으로 기록.

        return NextResponse.json({ success: true }, { status: 201 });
    } catch (error: unknown) {
        console.error('Join crew error:', error);
        return NextResponse.json({ error: '참여 신청 중 오류가 발생했습니다.' }, { status: 500 });
    }
}
