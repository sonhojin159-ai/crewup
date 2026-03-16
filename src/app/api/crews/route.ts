import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { rateLimitByUser } from '@/lib/rateLimit';

interface MissionInput {
    title: string;
    description?: string;
    rewardPoints: number;
}

export async function POST(request: Request) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate Limiting: 크루 생성은 분당 3회로 제한
    const { success: rlSuccess } = rateLimitByUser(user.id, 'crew-create', 3, 60_000);
    if (!rlSuccess) {
        return NextResponse.json({ error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' }, { status: 429 });
    }

    // 블랙리스트 체크
    const { data: blacklisted } = await supabase
        .from('blacklist')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

    if (blacklisted) {
        return NextResponse.json({ error: '제재된 계정으로는 크루를 생성할 수 없습니다.' }, { status: 403 });
    }

    try {
        const body = await request.json();
        const {
            title, category, roleType, track, description, maxMembers, tags,
            entryPoints, leaderMarginRate, missionRewardRate, missions,
            deposit, activityDays,
        } = body;

        // 필수값 검증
        if (!title || !category || !roleType || !description || !track) {
            return NextResponse.json({ error: '필수 입력값이 누락되었습니다.' }, { status: 400 });
        }

        // 입력값 범위 검증
        const parsedMaxMembers = Number(maxMembers) || 6;
        if (parsedMaxMembers < 2 || parsedMaxMembers > 20) {
            return NextResponse.json({ error: '최대 인원은 2~20명 사이여야 합니다.' }, { status: 400 });
        }

        // 포인트 설계 검증
        const entry = Number(entryPoints) || 0;
        const leaderRate = Number(leaderMarginRate) || 0;
        const rewardRate = Number(missionRewardRate) || 0;

        if (leaderRate < 0 || leaderRate > 100 || rewardRate < 0 || rewardRate > 100) {
            return NextResponse.json({ error: '비율은 0~100 사이여야 합니다.' }, { status: 400 });
        }

        if (entry < 0) {
            return NextResponse.json({ error: '참여 포인트는 0 이상이어야 합니다.' }, { status: 400 });
        }

        if (leaderRate + rewardRate !== 100) {
            return NextResponse.json({ error: '배분율 합산이 정확히 100%여야 합니다.' }, { status: 400 });
        }

        if (track === 'revenue_share' && leaderRate > 80) {
            return NextResponse.json({ error: '수익 분배형 크루장 배분율은 최대 80%입니다.' }, { status: 400 });
        }

        if (track === 'mission' && entry > 0 && (!missions || missions.length === 0)) {
            return NextResponse.json({ error: '미션 달성형 크루는 미션을 1개 이상 설정해야 합니다.' }, { status: 400 });
        }

        // 미션 길이 검증
        if (missions && missions.length > 0) {
            for (const m of missions as MissionInput[]) {
                if (m.title && m.title.trim().length > 100) {
                    return NextResponse.json({ error: '미션 제목은 100자 이하여야 합니다.' }, { status: 400 });
                }
                if (m.description && m.description.trim().length > 1000) {
                    return NextResponse.json({ error: '미션 설명은 1000자 이하여야 합니다.' }, { status: 400 });
                }
            }
        }

        const parsedDeposit = Number(deposit) || 0;

        // [C2 수정] process_crew_creation RPC로 잔액 확인~크루 생성~미션 생성을
        // 단일 트랜잭션으로 처리 (SELECT FOR UPDATE로 Race Condition 방지)
        const { data: rpcResult, error: rpcError } = await supabase.rpc('process_crew_creation', {
            p_user_id:             user.id,
            p_title:               title,
            p_category:            category,
            p_role_type:           roleType,
            p_track:               track,
            p_description:         description,
            p_max_members:         parsedMaxMembers,
            p_tags:                tags || [],
            p_entry_points:        entry,
            p_deposit:             parsedDeposit,
            p_leader_margin_rate:  leaderRate,
            p_mission_reward_rate: rewardRate,
            p_missions:            (track === 'mission' && missions?.length > 0)
                                     ? missions
                                     : null,
            p_activity_days:       Number(activityDays) || 7,
        });

        if (rpcError) {
            console.error('process_crew_creation RPC error:', rpcError);
            throw rpcError;
        }

        const result = rpcResult as { success: boolean; error?: string; crew_id?: string };

        if (!result.success) {
            return NextResponse.json({ error: result.error || '크루 생성에 실패했습니다.' }, { status: 400 });
        }

        return NextResponse.json({ id: result.crew_id }, { status: 201 });
    } catch (error: unknown) {
        console.error('Crew creation error:', error);
        return NextResponse.json({ error: '크루 생성 중 오류가 발생했습니다.' }, { status: 500 });
    }
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const role = searchParams.get('role');
    const track = searchParams.get('track');
    const searchQuery = searchParams.get('search');
    const filter = searchParams.get('filter'); // Joined filter

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    let query;

    if (filter === 'joined') {
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        // 내가 참여한 크루: 내 멤버십 정보가 있어야 하며, 거절되지 않은 것만
        // 필터링용 inner join과 표시용 count join을 분리하여 정확한 데이터 조회
        query = supabase
            .from('crews')
            .select(`
                *,
                my_membership:crew_members!inner(user_id, status),
                crew_members(count)
            `)
            .eq('my_membership.user_id', user.id)
            .neq('my_membership.status', 'rejected');
    } else {
        // 공개 목록: 단순히 active 상태인 크루 (inner join 없이 count만 가져옴)
        query = supabase
            .from('crews')
            .select('*, crew_members(count)')
            .eq('status', 'active');
    }

    if (category && category !== '전체') {
        query = query.eq('category', category);
    }

    if (role && role !== 'all') {
        query = query.eq('role_type', role);
    }

    if (track && track !== 'all') {
        query = query.eq('track', track);
    }

    if (searchQuery) {
        const safeQuery = searchQuery.slice(0, 50); // m7 Fix: 검색어 길이 제한
        query = query.ilike('title', `%${safeQuery}%`);
    }

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) {
        console.error('Crew list fetch error:', error);
        return NextResponse.json({ error: '크루 목록 조회 중 오류가 발생했습니다.' }, { status: 500 });
    }

    return NextResponse.json(data);
}
