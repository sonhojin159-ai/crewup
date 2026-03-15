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

        // [C3 수정] process_crew_leave RPC로 에스크로 몰수 + 분배 + 멤버 상태 변경을
        // 단일 트랜잭션으로 처리 (비원자성 문제 해결)
        const { data: rpcResult, error: rpcError } = await supabase.rpc('process_crew_leave', {
            p_crew_id: id,
            p_user_id: user.id,
        });

        if (rpcError) {
            console.error('process_crew_leave RPC error:', rpcError);
            throw rpcError;
        }

        const result = rpcResult as { success: boolean; error?: string; forfeited_amount?: number };

        if (!result.success) {
            return NextResponse.json({ error: result.error || '탈퇴 처리에 실패했습니다.' }, { status: 400 });
        }

        return NextResponse.json({ success: true }, { status: 200 });

    } catch (error: unknown) {
        console.error('Leave Crew Error:', error);
        return NextResponse.json({ error: '크루 탈퇴 처리 중 오류가 발생했습니다.' }, { status: 500 });
    }
}
