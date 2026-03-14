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
            deposit,
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

        // 예치금 및 크루장 수수료 예치 로직
        const parsedDeposit = Number(deposit) || 0;
        const leaderFeeDeposit = parsedMaxMembers * entry;
        // 2. 크루장 수수료 예치금 계산 및 차감 (전체 인원의 가입비만큼 예치)

        if (leaderFeeDeposit > 0) {
            // 크루장 잔액 확인 및 차감
            const { data: wallet, error: walletError } = await supabase
                .from('user_points')
                .select('balance')
                .eq('user_id', user.id)
                .single();

            if (walletError || !wallet || wallet.balance < leaderFeeDeposit) {
                return NextResponse.json({ error: `크루장 예치금($${leaderFeeDeposit})이 부족합니다.` }, { status: 400 });
            }

            // 트랜잭션 (포인트 차감 + 기록) - 단순화를 위해 순차 실행 (실제론 RPC나 트랜잭션 권장)
            const { error: deductError } = await supabase
                .from('user_points')
                .update({ balance: wallet.balance - leaderFeeDeposit })
                .eq('user_id', user.id);

            if (deductError) throw deductError;

            await supabase.from('point_transactions').insert({
                user_id: user.id,
                type: 'platform_fee', // 또는 새로운 타입 'leader_deposit'
                amount: -leaderFeeDeposit,
                balance_after: wallet.balance - leaderFeeDeposit,
                note: `크루 생성에 따른 수수료 예치 (${title})`
            });
        }

        // 크루 생성
        const { data: crew, error: crewError } = await supabase
            .from('crews')
            .insert({
                title,
                category,
                role_type: roleType,
                track,
                description,
                max_members: parsedMaxMembers,
                tags: tags || [],
                created_by: user.id,
                entry_points: entry,
                leader_margin_rate: leaderRate,
                mission_reward_rate: rewardRate,
                status: 'active', // 명시적 상태 설정
                deposit: parsedDeposit,
                leader_fee_deposit: leaderFeeDeposit
            })
            .select()
            .single();

        if (crewError) throw crewError;

        // 크루장을 멤버로 등록 (active, owner) - 트리거와의 충돌 방지를 위해 upsert 사용
        const { error: memberError } = await supabase
            .from('crew_members')
            .upsert({
                crew_id: crew.id,
                user_id: user.id,
                status: 'active',
                role: 'owner',
                payment_status: 'paid', // 크루장은 참여금 면제/기결제 처리
                approved_at: new Date().toISOString(),
                paid_at: new Date().toISOString()
            }, { 
                onConflict: 'crew_id,user_id' 
            });

        if (memberError) {
            console.error('Leader member insertion/upsert error:', memberError);
            // 실패 시 생성된 크루 삭제 (롤백)
            await supabase.from('crews').delete().eq('id', crew.id);
            throw memberError;
        }

        // 미션 생성 (있으면)
        if (track === 'mission' && missions && missions.length > 0) {
            const missionRows = missions
                .filter((m: MissionInput) => m.title?.trim())
                .map((m: MissionInput, i: number) => ({
                    crew_id: crew.id,
                    title: m.title.trim(),
                    description: m.description?.trim() || null,
                    order_index: i + 1,
                    reward_points: Number(m.rewardPoints) || 0,
                }));

            if (missionRows.length > 0) {
                const { error: missionError } = await supabase
                    .from('missions')
                    .insert(missionRows);

                if (missionError) {
                    // 미션 실패 시 크루도 삭제 (롤백)
                    await supabase.from('crews').delete().eq('id', crew.id);
                    throw missionError;
                }
            }
        }

        return NextResponse.json(crew, { status: 201 });
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

    const supabase = await createClient();

    let query = supabase
        .from('crews')
        .select('*, crew_members(count)')
        .eq('status', 'active');

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
