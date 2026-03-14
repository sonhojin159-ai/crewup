import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { rateLimitByUser } from '@/lib/rateLimit';

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string; missionId: string }> }
) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { success } = rateLimitByUser(user.id, 'mission-submit', 10, 60_000);
    if (!success) {
        return NextResponse.json({ error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' }, { status: 429 });
    }

    try {
        const { id, missionId } = await params;
        const body = await request.json().catch(() => ({}));
        const content = body.content?.trim() || '';

        if (!content) {
            return NextResponse.json({ error: '인증 내용을 입력해주세요.' }, { status: 400 });
        }
        if (content.length > 1000) {
            return NextResponse.json({ error: '인증 내용은 1000자 이하로 입력해주세요.' }, { status: 400 });
        }

        // 크루 활성 멤버인지 확인
        const { data: membership } = await supabase
            .from('crew_members')
            .select('id')
            .eq('crew_id', id)
            .eq('user_id', user.id)
            .eq('status', 'active')
            .maybeSingle();

        if (!membership) {
            return NextResponse.json({ error: '이 크루의 활성 멤버만 인증할 수 있습니다.' }, { status: 403 });
        }

        // 미션 존재 확인
        const { data: mission } = await supabase
            .from('missions')
            .select('id, title')
            .eq('id', missionId)
            .eq('crew_id', id)
            .single();

        if (!mission) {
            return NextResponse.json({ error: '미션을 찾을 수 없습니다.' }, { status: 404 });
        }

        // 이미 제출한 인증이 있는지 확인
        const { data: existing } = await supabase
            .from('mission_submissions')
            .select('id, status')
            .eq('mission_id', missionId)
            .eq('submitted_by', user.id)
            .maybeSingle();

        if (existing) {
            if (existing.status === 'approved') {
                return NextResponse.json({ error: '이미 승인된 인증입니다.' }, { status: 400 });
            }
            if (existing.status === 'pending') {
                return NextResponse.json({ error: '이미 인증을 제출했습니다. 크루장의 검토를 기다려주세요.' }, { status: 400 });
            }
            // rejected인 경우 재제출 가능 - 기존 삭제 후 재생성
            await supabase.from('mission_submissions').delete().eq('id', existing.id);
        }

        // 인증 제출
        const { data: submission, error: insertError } = await supabase
            .from('mission_submissions')
            .insert({
                mission_id: missionId,
                crew_id: id,
                submitted_by: user.id,
                content,
                status: 'pending',
            })
            .select('id')
            .single();

        if (insertError) {
            console.error('Mission submission error:', insertError);
            return NextResponse.json({ error: '인증 제출 중 오류가 발생했습니다.' }, { status: 500 });
        }

        return NextResponse.json({ success: true, submissionId: submission.id }, { status: 201 });

    } catch (error: unknown) {
        console.error('Mission submit error:', error);
        return NextResponse.json({ error: '인증 제출 중 오류가 발생했습니다.' }, { status: 500 });
    }
}

