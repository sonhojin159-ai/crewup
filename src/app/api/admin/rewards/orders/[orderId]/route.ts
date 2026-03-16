import { createAdminClient, isAdmin } from '@/lib/admin';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || !isAdmin(user.email)) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
  }

  const { orderId } = await params;

  let body: {
    status?: string;
    tracking_number?: string;
    admin_memo?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '잘못된 요청 형식입니다.' }, { status: 400 });
  }

  const validStatuses = ['pending', 'preparing', 'shipped', 'delivered', 'cancelled'];
  if (body.status && !validStatuses.includes(body.status)) {
    return NextResponse.json({ error: '유효하지 않은 상태값입니다.' }, { status: 400 });
  }

  const adminSupabase = createAdminClient();

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (body.status) updateData.status = body.status;
  if (body.tracking_number !== undefined) updateData.tracking_number = body.tracking_number;
  if (body.admin_memo !== undefined) updateData.admin_memo = body.admin_memo;

  // 배송완료 시 30일 후 비식별화 예약
  if (body.status === 'delivered') {
    const deleteAt = new Date();
    deleteAt.setDate(deleteAt.getDate() + 30);
    updateData.address_deleted_at = deleteAt.toISOString();
  }

  const { data, error } = await adminSupabase
    .from('reward_orders')
    .update(updateData)
    .eq('id', orderId)
    .select()
    .single();

  if (error) {
    console.error('Admin reward order update error:', error);
    return NextResponse.json({ error: '주문 상태 업데이트 중 오류가 발생했습니다.' }, { status: 500 });
  }

  return NextResponse.json(data);
}
