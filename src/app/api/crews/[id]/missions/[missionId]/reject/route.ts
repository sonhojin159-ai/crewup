import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string; missionId: string }> }
) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { id, missionId } = await params;

        // 1. 크루장 권한 확인
        const { data: crew, error: crewError } = await supabase
            .from('crews')
            .select('created_by')
            .eq('id', id)
            .single();

        if (crewError || !crew) {
            return NextResponse.json({ error: '크루를 찾을 수 없습니다.' }, { status: 404 });
        }

        if (crew.created_by !== user.id) {
            return NextResponse.json({ error: '크루장만 인증 처리를 할 수 있습니다.' }, { status: 403 });
        }

        const body = await request.json().catch(() => ({}));
        const { submissionId, reason } = body;

        if (!submissionId) {
            return NextResponse.json({ error: '인증 신청 ID(submissionId)가 필요합니다.' }, { status: 400 });
        }

        // 2. 제출 정보 업데이트 (rejected)
        const { error: updateError } = await supabase
            .from('mission_submissions')
            .update({ 
                status: 'rejected',
                admin_note: reason || '크루장에 의해 반려되었습니다.'
            })
            .eq('id', submissionId)
            .eq('mission_id', missionId);

        if (updateError) throw updateError;

        return NextResponse.json({ success: true }, { status: 200 });

    } catch (error: unknown) {
        console.error('Reject Mission Error:', error);
        return NextResponse.json({ error: '미션 반려 처리 중 오류가 발생했습니다.' }, { status: 500 });
    }
}
