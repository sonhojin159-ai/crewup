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
        const { submissionId, note } = body;

        if (!submissionId) {
            return NextResponse.json({ error: '인증 신청 ID(submissionId)가 필요합니다.' }, { status: 400 });
        }

        // 2. 제출 정보 조회 (제출자 확인)
        const { data: submission, error: subError } = await supabase
            .from('mission_submissions')
            .select('submitted_by, status')
            .eq('id', submissionId)
            .eq('mission_id', missionId)
            .single();

        if (subError || !submission) {
            return NextResponse.json({ error: '제출 정보를 찾을 수 없습니다.' }, { status: 404 });
        }

        if (submission.status === 'approved') {
            return NextResponse.json({ error: '이미 승인된 제출건입니다.' }, { status: 400 });
        }

        // 3. submission 상태를 먼저 'approved'로 원자적 업데이트 (중복 승인 방지)
        const { data: updated } = await supabase
            .from('mission_submissions')
            .update({ status: 'approved' })
            .eq('id', submissionId)
            .eq('status', 'pending')
            .select('id');

        if (!updated || updated.length === 0) {
            return NextResponse.json({ error: '이미 처리된 제출건입니다.' }, { status: 409 });
        }

        // 4. 인증 내역 INSERT (개별 제출 건에 대해 생성)
        const { data: verification, error: insertError } = await supabase
            .from('mission_verifications')
            .insert({
                mission_id: missionId,
                crew_id: id,
                verified_by: user.id,
                submission_id: submissionId,
                user_id: submission.submitted_by,
                note: note || null
            })
            .select('id')
            .single();

        if (insertError) throw insertError;

        // 5. 개별 리워드 배분 RPC 호출
        const { error: rpcError } = await supabase.rpc('distribute_individual_mission_reward', {
            p_verification_id: verification.id,
        });

        if (rpcError) {
            console.error('RPC Error:', rpcError);
            throw rpcError;
        }

        return NextResponse.json({ success: true, verification_id: verification.id }, { status: 200 });

    } catch (error: unknown) {
        console.error('Verify Mission Error:', error);
        return NextResponse.json({ error: '미션 인증 처리 중 오류가 발생했습니다.' }, { status: 500 });
    }
}
