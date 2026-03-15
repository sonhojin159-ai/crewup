import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// POST /api/crews/[id]/missions/[missionId]/reward — 크루원이 리워드 신청
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
    const { id: crewId, missionId } = await params;

    // 1. 해당 미션이 존재하고 이 크루에 속하는지 확인
    const { data: mission, error: missionError } = await supabase
      .from('missions')
      .select('id, title, reward_points, crew_id')
      .eq('id', missionId)
      .eq('crew_id', crewId)
      .single();

    if (missionError || !mission) {
      return NextResponse.json({ error: '미션을 찾을 수 없습니다.' }, { status: 404 });
    }

    // 2. 사용자가 해당 크루 액티브 멤버인지 확인
    const { data: membership } = await supabase
      .from('crew_members')
      .select('id')
      .eq('crew_id', crewId)
      .eq('user_id', user.id)
      .in('status', ['active', 'owner'])
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ error: '크루 멤버만 리워드를 신청할 수 있습니다.' }, { status: 403 });
    }

    // 3. 해당 미션에 대한 승인된(approved) 인증 제출이 있는지 확인
    const { data: approvedSubmission } = await supabase
      .from('mission_submissions')
      .select('id')
      .eq('mission_id', missionId)
      .eq('submitted_by', user.id)
      .eq('status', 'approved')
      .maybeSingle();

    if (!approvedSubmission) {
      return NextResponse.json({ error: '승인된 미션 인증이 없습니다. 크루장 승인 후 신청 가능합니다.' }, { status: 400 });
    }

    // 4. 인증 기록 조회 및 배분 상태 확인
    const { data: verification } = await supabase
      .from('mission_verifications')
      .select('id, distribution_status')
      .eq('mission_id', missionId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!verification) {
      return NextResponse.json({ error: '미션 인증 내역이 없습니다. 크루장 승인 후 신청 가능합니다.' }, { status: 400 });
    }

    if (verification.distribution_status === 'completed') {
      return NextResponse.json({ error: '이미 이 미션의 리워드를 수령했습니다.' }, { status: 400 });
    }

    // 5. RPC 호출로 개인 리워드 지급 (올바른 시그니처: p_verification_id)
    const { error: rpcError } = await supabase.rpc('distribute_individual_mission_reward', {
      p_verification_id: verification.id,
    });

    if (rpcError) {
      console.error('Reward claim RPC error:', rpcError);
      return NextResponse.json({ error: '리워드 지급 중 오류가 발생했습니다.' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `${mission.reward_points}P 리워드가 지급되었습니다.`,
    });

  } catch (error: unknown) {
    console.error('Reward claim error:', error);
    return NextResponse.json({ error: '리워드 신청 처리 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
