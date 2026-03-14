import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { rateLimitByUser } from '@/lib/rateLimit';

const VALID_REPORT_TYPES = [
    'revenue_hiding',
    'payment_default',
    'unauthorized_expense',
    'fraud',
    'harassment',
    'other',
] as const;

export async function POST(request: Request) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { success } = rateLimitByUser(user.id, 'report', 5, 300_000); // 5분당 5회
    if (!success) {
        return NextResponse.json({ error: '신고 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' }, { status: 429 });
    }

    try {
        const body = await request.json();
        const { targetUserId, crewId, reportType, title, description } = body;

        if (!reportType || !VALID_REPORT_TYPES.includes(reportType)) {
            return NextResponse.json({ error: '유효하지 않은 신고 유형입니다.' }, { status: 400 });
        }

        if (!title?.trim() || !description?.trim()) {
            return NextResponse.json({ error: '신고 제목과 내용은 필수입니다.' }, { status: 400 });
        }

        if (title.trim().length > 100) {
            return NextResponse.json({ error: '제목은 100자 이내로 작성해주세요.' }, { status: 400 });
        }

        if (description.trim().length > 2000) {
            return NextResponse.json({ error: '내용은 2000자 이내로 작성해주세요.' }, { status: 400 });
        }

        // 자기 자신은 신고 불가
        if (targetUserId === user.id) {
            return NextResponse.json({ error: '자기 자신을 신고할 수 없습니다.' }, { status: 400 });
        }

        // 블랙리스트 체크 (신고 대상이 이미 블랙리스트인 경우)
        if (targetUserId) {
            const { data: blacklisted } = await supabase
                .from('blacklist')
                .select('id')
                .eq('user_id', targetUserId)
                .maybeSingle();

            if (blacklisted) {
                return NextResponse.json({ error: '이미 제재된 사용자입니다.' }, { status: 400 });
            }
        }

        const { data: report, error } = await supabase
            .from('reports')
            .insert({
                reporter_id: user.id,
                target_user_id: targetUserId || null,
                crew_id: crewId || null,
                report_type: reportType,
                title: title.trim(),
                description: description.trim(),
                status: 'pending',
            })
            .select('id')
            .single();

        if (error) {
            console.error('Report creation error:', error);
            return NextResponse.json({ error: '신고 접수 중 오류가 발생했습니다.' }, { status: 500 });
        }

        return NextResponse.json({ success: true, reportId: report.id }, { status: 201 });

    } catch (error: unknown) {
        console.error('Report API error:', error);
        return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
    }
}

// 내 신고 내역 조회
export async function GET() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
        .from('reports')
        .select('id, report_type, title, status, created_at, resolved_at')
        .eq('reporter_id', user.id)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Report list error:', error);
        return NextResponse.json({ error: '신고 내역 조회 중 오류가 발생했습니다.' }, { status: 500 });
    }

    return NextResponse.json(data || []);
}
