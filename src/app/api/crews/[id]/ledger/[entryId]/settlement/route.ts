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

  // 멤버십 검증: 크루 멤버 또는 크루장만 정산 내역 조회 가능
  const [{ data: crew }, { data: membership }] = await Promise.all([
    supabase.from('crews').select('created_by').eq('id', id).single(),
    supabase.from('crew_members').select('id').eq('crew_id', id).eq('user_id', user.id).eq('status', 'active').maybeSingle(),
  ]);
  if (!crew || (crew.created_by !== user.id && !membership)) {
    return NextResponse.json({ error: '크루 멤버만 정산 내역을 조회할 수 있습니다.' }, { status: 403 });
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

// POST: 정산 실행 (크루장만) - 포인트 실제 이동 포함
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
    // 크루장 확인
    const { data: crew } = await supabase
      .from('crews')
      .select('created_by, track')
      .eq('id', id)
      .single();

    if (!crew || crew.created_by !== user.id) {
      return NextResponse.json({ error: '크루장만 정산을 실행할 수 있습니다.' }, { status: 403 });
    }

    if (crew.track !== 'revenue_share') {
      return NextResponse.json({ error: '수익 분배형 크루 전용 기능입니다.' }, { status: 400 });
    }

    // [C4 수정] process_settlement_transfers RPC로 포인트 이동 + 기록을 원자적으로 처리
    const { data: rpcResult, error: rpcError } = await supabase.rpc(
      'process_settlement_transfers',
      { p_entry_id: entryId }
    );

    if (rpcError) {
      console.error('process_settlement_transfers RPC error:', rpcError);
      return NextResponse.json({ error: '정산 처리 중 오류가 발생했습니다.' }, { status: 500 });
    }

    const result = rpcResult as {
      success: boolean;
      error?: string;
      net_profit?: number;
      total_distributed?: number;
      per_member_share?: number;
      member_count?: number;
      remainder?: number;
    };

    if (!result.success) {
      const status = result.error?.includes('이미 정산') ? 409 : 400;
      return NextResponse.json({ error: result.error || '정산에 실패했습니다.' }, { status });
    }

    return NextResponse.json({
      success: true,
      netProfit: result.net_profit,
      leaderShare: (result.net_profit ?? 0) - (result.total_distributed ?? 0),
      perMemberShare: result.per_member_share,
      memberCount: result.member_count,
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
