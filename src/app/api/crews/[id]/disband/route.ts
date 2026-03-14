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

        // 4. 크루 및 멤버 상태를 해산으로 업데이트
        // (RLS 때문에 supabase service_role 키를 쓰거나, 자신이 만든 크루는 업데이트 가능)
        const { error: crewUpdateError } = await supabase
            .from('crews')
            .update({ status: 'disbanded' })
            .eq('id', id);

        if (crewUpdateError) throw crewUpdateError;

        // 멤버들의 상태 변경 
        // members 테이블에 업데이트 권한이 크루장에게 있는지(RLS) 확인
        const { error: membersUpdateError } = await supabase
            .from('crew_members')
            .update({ status: 'disbanded' })
            .eq('crew_id', id);

        if (membersUpdateError) throw membersUpdateError;

        return NextResponse.json({ success: true }, { status: 200 });

    } catch (error: unknown) {
        console.error('Disband Crew Error:', error);
        return NextResponse.json({ error: '크루 해산 중 오류가 발생했습니다.' }, { status: 500 });
    }
}
