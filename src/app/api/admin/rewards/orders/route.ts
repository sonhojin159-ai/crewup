import { createAdminClient, isAdmin } from '@/lib/admin';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || !isAdmin(user.email)) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');

  const adminSupabase = createAdminClient();

  let query = adminSupabase
    .from('reward_orders')
    .select(`
      id,
      user_id,
      recipient_name,
      recipient_phone,
      recipient_address,
      points_spent,
      status,
      tracking_number,
      admin_memo,
      consented_at,
      created_at,
      updated_at,
      address_deleted_at,
      profiles:user_id (
        nickname,
        email
      ),
      rewards_store:item_id (
        title,
        image_url,
        point_price,
        original_url
      )
    `)
    .order('created_at', { ascending: false });

  if (status && status !== 'all') {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Admin reward orders fetch error:', error);
    return NextResponse.json({ error: '주문 목록 조회 중 오류가 발생했습니다.' }, { status: 500 });
  }

  // 비식별화 처리: address_deleted_at이 과거인 경우 배송지 마스킹
  const masked = data?.map((order) => {
    if (order.address_deleted_at && new Date(order.address_deleted_at) <= new Date()) {
      return {
        ...order,
        recipient_name: '***',
        recipient_phone: '***',
        recipient_address: '비식별화 처리됨',
      };
    }
    return order;
  });

  return NextResponse.json(masked);
}
