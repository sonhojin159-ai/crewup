import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { rateLimitByUser } from '@/lib/rateLimit';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('reward_orders')
    .select(`
      id,
      points_spent,
      status,
      tracking_number,
      created_at,
      rewards_store (
        title,
        image_url,
        point_price
      )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Reward orders fetch error:', error);
    return NextResponse.json({ error: '주문 목록 조회 중 오류가 발생했습니다.' }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const { success: rlSuccess } = rateLimitByUser(user.id, 'reward-order', 5, 60_000);
  if (!rlSuccess) {
    return NextResponse.json({ error: '잠시 후 다시 시도해주세요.' }, { status: 429 });
  }

  let body: {
    item_id?: string;
    recipient_name?: string;
    recipient_phone?: string;
    recipient_address?: string;
    consented?: boolean;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '잘못된 요청 형식입니다.' }, { status: 400 });
  }

  const { item_id, recipient_name, recipient_phone, recipient_address, consented } = body;

  if (!item_id || !recipient_name?.trim() || !recipient_phone?.trim() || !recipient_address?.trim()) {
    return NextResponse.json({ error: '모든 배송 정보를 입력해주세요.' }, { status: 400 });
  }

  if (!consented) {
    return NextResponse.json({ error: '개인정보 제3자 제공에 동의해주세요.' }, { status: 400 });
  }

  const { data, error } = await supabase.rpc('process_reward_order', {
    p_user_id: user.id,
    p_item_id: item_id,
    p_recipient_name: recipient_name.trim(),
    p_recipient_phone: recipient_phone.trim(),
    p_recipient_address: recipient_address.trim(),
    p_consented_at: new Date().toISOString(),
  });

  if (error) {
    console.error('Reward order RPC error:', error);
    return NextResponse.json({ error: '주문 처리 중 오류가 발생했습니다.' }, { status: 500 });
  }

  if (!data.success) {
    return NextResponse.json({ error: data.error }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    order_id: data.order_id,
    points_spent: data.points_spent,
  });
}
