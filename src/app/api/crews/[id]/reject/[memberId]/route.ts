import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(
    _request: Request,
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
            .select('created_by')
            .eq('id', id)
            .single();

        if (crewError || !crew) {
            return NextResponse.json({ error: '크루를 찾을 수 없습니다.' }, { status: 404 });
        }

        if (crew.created_by !== user.id) {
            return NextResponse.json({ error: '크루장만 신청을 반려할 수 있습니다.' }, { status: 403 });
        }

        // 2. 신청 정보 검증 (IDOR 방지: crew_id 함께 확인)
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

        // 3. 반려 처리 (재신청 불가 — status: 'rejected'로 영구 기록)
        const { error: updateError } = await supabase
            .from('crew_members')
            .update({ status: 'rejected', rejected_at: new Date().toISOString() })
            .eq('id', memberId)
            .eq('crew_id', id);

        if (updateError) throw updateError;

        return NextResponse.json({ success: true }, { status: 200 });

    } catch (error: unknown) {
        console.error('Reject Error:', error);
        return NextResponse.json({ error: '반려 처리 중 오류가 발생했습니다.' }, { status: 500 });
    }
}
