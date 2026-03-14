import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { rateLimitByUser } from '@/lib/rateLimit';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; entryId: string }> }
) {
  const { id, entryId } = await params;
  const supabase = await createClient();

  // 1. 사용자 확인
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { success: rlSuccess } = rateLimitByUser(user.id, 'ledger-approve', 20, 60_000);
  if (!rlSuccess) {
    return NextResponse.json({ error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' }, { status: 429 });
  }

  try {
    const { approved } = await request.json();
    if (typeof approved !== 'boolean') {
      return NextResponse.json({ error: 'approved 값(boolean)이 누락되었습니다.' }, { status: 400 });
    }

    // 2. 크루 멤버인지 확인 및 track 검증
    const { data: crew } = await supabase
      .from('crews')
      .select('track, max_members, crew_members!inner(user_id, status)')
      .eq('id', id)
      .eq('crew_members.user_id', user.id)
      .eq('crew_members.status', 'active')
      .single();

    if (!crew) {
      return NextResponse.json({ error: '이 크루의 활성 멤버가 아닙니다.' }, { status: 403 });
    }

    if (crew.track !== 'revenue_share') {
      return NextResponse.json({ error: '수익 분배형 크루 전용 기능입니다.' }, { status: 400 });
    }

    // 3. RPC로 원자적 승인 + 잠금 처리 (Race Condition 방지)
    const { data: result, error: rpcError } = await supabase.rpc('approve_and_lock_ledger', {
      p_entry_id: entryId,
      p_crew_id: id,
      p_user_id: user.id,
      p_approved: approved,
    });

    if (rpcError) {
      console.error('Ledger approve RPC error:', rpcError);
      return NextResponse.json({ error: '장부 승인 처리 중 오류가 발생했습니다.' }, { status: 500 });
    }

    if (result && !result.success) {
      console.error('Ledger approve business error:', result.error);
      return NextResponse.json({ error: '장부 승인 처리에 실패했습니다.' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      approved,
      locked: result?.locked || false,
    });
  } catch (error: unknown) {
    console.error('Ledger approve error:', error);
    return NextResponse.json({ error: '장부 승인 처리 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
