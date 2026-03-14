import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { id } = await params;
        const body = await request.json().catch(() => ({}));

        if (!body.confirm) {
            return NextResponse.json({ error: '탈퇴 확인이 필요합니다.' }, { status: 400 });
        }

        // 1. 크루장인지 확인 (크루장은 일반 탈퇴 불가, 해산만 가능)
        const { data: crew, error: crewError } = await supabase
            .from('crews')
            .select('created_by')
            .eq('id', id)
            .single();

        if (crewError || !crew) {
            return NextResponse.json({ error: '크루를 찾을 수 없습니다.' }, { status: 404 });
        }

        if (crew.created_by === user.id) {
            return NextResponse.json({ error: '크루장은 탈퇴할 수 없습니다. 크루 해산을 이용해주세요.' }, { status: 403 });
        }

        // 2. 현재 참여 상태 확인
        const { data: member, error: memberError } = await supabase
            .from('crew_members')
            .select('id, status, payment_status')
            .eq('crew_id', id)
            .eq('user_id', user.id)
            .single();

        if (memberError || !member) {
            return NextResponse.json({ error: '참여 중인 크루가 아닙니다.' }, { status: 400 });
        }

        if (member.status === 'left') {
            return NextResponse.json({ error: '이미 탈퇴한 크루입니다.' }, { status: 400 });
        }

        // 3. 상태 업데이트 및 포인트 처리 (에스크로 몰수)
        // payment_status가 paid인 경우에만 에스크로 몰수 처리
        if (member.payment_status === 'paid') {
            const { data: updatedHolds, error: escrowError } = await supabase
                .from('escrow_holds')
                .update({ status: 'forfeited', updated_at: new Date().toISOString() })
                .eq('crew_id', id)
                .eq('member_user_id', user.id)
                .in('status', ['holding', 'partially_released'])
                .select('amount'); // m4 Fix: UPDATE 반환값을 직접 사용하여 중복 합산 방지

            if (escrowError) throw escrowError;

            // m4 Fix: 이번 탈퇴에서 실제로 몰수된 금액만 사용
            const forfeitedAmount = (updatedHolds || []).reduce(
                (sum: number, h: { amount: number }) => sum + (h.amount || 0), 0
            );

            if (forfeitedAmount > 0) {
                const { data: upData, error: upError } = await supabase
                    .from('user_points')
                    .select('escrow_balance')
                    .eq('user_id', user.id)
                    .single();

                if (!upError && upData) {
                    const newEscrow = Math.max(0, (upData.escrow_balance || 0) - forfeitedAmount);
                    await supabase
                        .from('user_points')
                        .update({ escrow_balance: newEscrow })
                        .eq('user_id', user.id);
                }
            }

            // Fetch actual balance for the transaction log (BUG-17)
            const { data: userPoints } = await supabase
                .from('user_points')
                .select('balance')
                .eq('user_id', user.id)
                .single();

            const { error: txError } = await supabase
                .from('point_transactions')
                .insert({
                    user_id: user.id,
                    type: 'forfeiture',
                    amount: 0, 
                    balance_after: userPoints?.balance || 0,
                    crew_id: id,
                    note: '크루 자발적 탈퇴 - 에스크로 몰수'
                });

            if (txError) throw txError;
        }

        // 4. 멤버 상태 업데이트
        const { error: updateError } = await supabase
            .from('crew_members')
            .update({ status: 'left' })
            .eq('id', member.id);

        if (updateError) throw updateError;

        return NextResponse.json({ success: true }, { status: 200 });

    } catch (error: unknown) {
        console.error('Leave Crew Error:', error);
        return NextResponse.json({ error: '크루 탈퇴 처리 중 오류가 발생했습니다.' }, { status: 500 });
    }
}
