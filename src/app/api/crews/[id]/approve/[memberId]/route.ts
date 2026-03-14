import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string; memberId: string }> }
) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { id, memberId } = await params;

        // 1. 크루장 권한 확인
        const { data: crew, error: crewError } = await supabase
            .from('crews')
            .select('created_by, max_members')
            .eq('id', id)
            .single();

        if (crewError || !crew) {
            return NextResponse.json({ error: '크루를 찾을 수 없습니다.' }, { status: 404 });
        }

        if (crew.created_by !== user.id) {
            return NextResponse.json({ error: '크루장만 승인할 수 있습니다.' }, { status: 403 });
        }

        // 2. 신청 정보 검증 (SEC-08: IDOR 방지)
        const { data: member, error: memberErr } = await supabase
            .from('crew_members')
            .select('id, status')
            .eq('id', memberId)
            .eq('crew_id', id)
            .single();

        if (memberErr || !member) {
            return NextResponse.json({ error: '해당 크루의 신청 내역을 찾을 수 없습니다.' }, { status: 404 });
        }

        if (member.status !== 'pending') {
            return NextResponse.json({ error: '이미 처리된 신청입니다.' }, { status: 400 });
        }

        // 3. 정원 초과 확인 (active 멤버 수)
        const { count: activeCount, error: countError } = await supabase
            .from('crew_members')
            .select('*', { count: 'exact', head: true })
            .eq('crew_id', id)
            .eq('status', 'active');

        if (countError) throw countError;

        if (activeCount !== null && activeCount >= crew.max_members) {
            return NextResponse.json({ error: '크루 정원이 초과되었습니다.' }, { status: 400 });
        }

        // 3.RPC 호출 (잔액 확인 + 에스크로 예치 + 상태 변경 등 원자적 처리)
        const { error: rpcError } = await supabase.rpc('process_entry_payment_v2', {
            p_crew_member_id: memberId,
        });

        if (rpcError) {
            console.error('RPC Error:', rpcError);
            // 사용자 안내 메시지는 한국어 제네릭으로 처리, 원문은 서버 로그에만 남김
            if (rpcError.message.includes('포인트가 부족합니다')) {
                return NextResponse.json({ error: '포인트가 부족합니다. 잔액을 확인해 주세요.' }, { status: 400 });
            }
            if (rpcError.message.includes('이미 결제된')) {
                return NextResponse.json({ error: '이미 처리된 승인입니다.' }, { status: 400 });
            }
            return NextResponse.json({ error: '승인 처리 중 오류가 발생했습니다.' }, { status: 500 });
        }

        // 4. 승인 상태로 업데이트 (Crew_members 상태도 active 로 변경)
        const { error: updateError } = await supabase
            .from('crew_members')
            .update({ status: 'active', approved_at: new Date().toISOString() })
            .eq('id', memberId)
            .eq('crew_id', id);

        if (updateError) throw updateError;

        return NextResponse.json({ success: true }, { status: 200 });

    } catch (error: unknown) {
        console.error('Approve Error:', error);
        return NextResponse.json({ error: '승인 처리 중 오류가 발생했습니다.' }, { status: 500 });
    }
}
