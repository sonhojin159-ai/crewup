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

        // 1. 크루장 권한 확인
        const { data: crew, error: crewError } = await supabase
            .from('crews')
            .select('created_by, title')
            .eq('id', id)
            .single();

        if (crewError || !crew) {
            return NextResponse.json({ error: '크루를 찾을 수 없습니다.' }, { status: 404 });
        }

        if (crew.created_by !== user.id) {
            return NextResponse.json({ error: '크루장만 크루를 해산할 수 있습니다.' }, { status: 403 });
        }

        // 全액 환급 RPC 호출
        const { error: rpcError } = await supabase.rpc('process_full_refund_v2', {
            p_crew_id: id,
        });

        if (rpcError) {
             console.error('RPC Error:', rpcError);
            throw rpcError;
        }

        // 4. 크루 상태를 'abandoned'(중단)로 업데이트하여 장부 보존
        // 기존 'disbanded'는 물리적/논리적 삭제에 가깝지만, 'abandoned'는 멤버가 남을 수 있음.
        const { error: crewUpdateError } = await supabase
            .from('crews')
            .update({ status: 'abandoned' })
            .eq('id', id);

        if (crewUpdateError) throw crewUpdateError;

        // 멤버들의 상태는 disband 하지 않음 (장부 접근 권한 유지를 위해 active 유지)
        // 단, 크루장 본인 혹은 원하는 시점에 나갈 수 있음 (이미 refund는 위 RPC에서 처리됨)

        return NextResponse.json({ success: true }, { status: 200 });

    } catch (error: unknown) {
        console.error('Disband Crew Error:', error);
        return NextResponse.json({ error: '크루 해산 중 오류가 발생했습니다.' }, { status: 500 });
    }
}
