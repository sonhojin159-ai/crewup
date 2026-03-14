import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// GET: 해당 장부의 정산 내역 조회
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; entryId: string }> }
) {
  const { id, entryId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('settlement_transfers')
    .select(`
      *,
      from_profile:from_user_id (nickname),
      to_profile:to_user_id (nickname)
    `)
    .eq('entry_id', entryId)
    .eq('crew_id', id)
    .order('amount', { ascending: false });

  if (error) {
    console.error('Settlement fetch error:', error);
    return NextResponse.json({ error: '정산 내역 조회 중 오류가 발생했습니다.' }, { status: 500 });
  }

  return NextResponse.json(data || []);
}

// POST: 장부 확정 후 정산 기록 생성 (크루장만)
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; entryId: string }> }
) {
  const { id, entryId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 1. 크루장 확인 + 비율 가져오기
    const { data: crew } = await supabase
      .from('crews')
      .select('created_by, leader_margin_rate, mission_reward_rate, track')
      .eq('id', id)
      .single();

    if (!crew || crew.created_by !== user.id) {
      return NextResponse.json({ error: '크루장만 정산을 생성할 수 있습니다.' }, { status: 403 });
    }

    if (crew.track !== 'revenue_share') {
      return NextResponse.json({ error: '수익 분배형 크루 전용 기능입니다.' }, { status: 400 });
    }

    // 2. 장부가 확정(locked)인지 확인
    const { data: entry } = await supabase
      .from('ledger_entries')
      .select('is_locked, revenue, expense')
      .eq('id', entryId)
      .eq('crew_id', id)
      .single();

    if (!entry) {
      return NextResponse.json({ error: '장부를 찾을 수 없습니다.' }, { status: 404 });
    }

    if (!entry.is_locked) {
      return NextResponse.json({ error: '확정된 장부만 정산할 수 있습니다.' }, { status: 400 });
    }

    // 3. 이미 정산 기록이 있는지 확인
    const { data: existing } = await supabase
      .from('settlement_transfers')
      .select('id')
      .eq('entry_id', entryId)
      .limit(1);

    if (existing && existing.length > 0) {
      return NextResponse.json({ error: '이미 정산 기록이 존재합니다.' }, { status: 409 });
    }

    // 4. 활성 크루원 조회 (크루장 제외)
    const { data: members } = await supabase
      .from('crew_members')
      .select('user_id')
      .eq('crew_id', id)
      .eq('status', 'active')
      .neq('user_id', crew.created_by);

    if (!members || members.length === 0) {
      return NextResponse.json({ error: '정산할 크루원이 없습니다.' }, { status: 400 });
    }

    // 5. 정산 금액 계산
    const netProfit = entry.revenue - entry.expense;

    if (netProfit <= 0) {
      return NextResponse.json({ error: '순수익이 0 이하일 때는 정산할 금액이 없습니다.' }, { status: 400 });
    }

    const memberShareRate = crew.mission_reward_rate; // 크루원 전체 몫 비율
    const totalMemberShare = Math.floor(netProfit * memberShareRate / 100);
    const perMemberShare = Math.floor(totalMemberShare / members.length);

    if (perMemberShare <= 0) {
      return NextResponse.json({ error: '1인당 정산 금액이 0원입니다.' }, { status: 400 });
    }

    // 6. 정산 기록 생성 (크루장 → 각 크루원)
    const transfers = members.map((m) => ({
      entry_id: entryId,
      crew_id: id,
      from_user_id: crew.created_by,
      to_user_id: m.user_id,
      amount: perMemberShare,
    }));

    const { error: insertError } = await supabase
      .from('settlement_transfers')
      .insert(transfers);

    if (insertError) {
      console.error('Settlement insert error:', insertError);
      return NextResponse.json({ error: '정산 기록 생성 중 오류가 발생했습니다.' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      netProfit,
      leaderShare: netProfit - totalMemberShare,
      perMemberShare,
      memberCount: members.length,
    }, { status: 201 });

  } catch (error: unknown) {
    console.error('Settlement API error:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// PATCH: 송금 확인 (보냈다 / 받았다)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; entryId: string }> }
) {
  const { id, entryId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { transferId, action } = await request.json();

    if (!transferId || !['confirm_sent', 'confirm_received'].includes(action)) {
      return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
    }

    // 해당 정산 기록 조회
    const { data: transfer } = await supabase
      .from('settlement_transfers')
      .select('*')
      .eq('id', transferId)
      .eq('entry_id', entryId)
      .eq('crew_id', id)
      .single();

    if (!transfer) {
      return NextResponse.json({ error: '정산 기록을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (action === 'confirm_sent') {
      if (transfer.from_user_id !== user.id) {
        return NextResponse.json({ error: '송금자만 보냈음을 확인할 수 있습니다.' }, { status: 403 });
      }

      const { error } = await supabase
        .from('settlement_transfers')
        .update({ sender_confirmed: true, sender_confirmed_at: new Date().toISOString() })
        .eq('id', transferId);

      if (error) throw error;
    } else if (action === 'confirm_received') {
      if (transfer.to_user_id !== user.id) {
        return NextResponse.json({ error: '수령자만 받았음을 확인할 수 있습니다.' }, { status: 403 });
      }

      const { error } = await supabase
        .from('settlement_transfers')
        .update({ receiver_confirmed: true, receiver_confirmed_at: new Date().toISOString() })
        .eq('id', transferId);

      if (error) throw error;
    }

    return NextResponse.json({ success: true });

  } catch (error: unknown) {
    console.error('Settlement confirm error:', error);
    return NextResponse.json({ error: '정산 확인 처리 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
