import { createAdminClient, isAdmin } from '@/lib/admin';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ productId: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || !isAdmin(user.email)) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
  }

  const { productId } = await params;

  let body: {
    title?: string;
    description?: string;
    point_price?: number;
    original_url?: string;
    image_url?: string;
    is_available?: boolean;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '잘못된 요청 형식입니다.' }, { status: 400 });
  }

  if (body.title !== undefined && (typeof body.title !== 'string' || body.title.trim().length === 0)) {
    return NextResponse.json({ error: '상품명은 비워둘 수 없습니다.' }, { status: 400 });
  }

  if (
    body.point_price !== undefined &&
    (typeof body.point_price !== 'number' || !Number.isInteger(body.point_price) || body.point_price <= 0)
  ) {
    return NextResponse.json({ error: '포인트가는 양수 정수여야 합니다.' }, { status: 400 });
  }

  const adminSupabase = createAdminClient();

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (body.title !== undefined) updateData.title = body.title.trim();
  if (body.description !== undefined) updateData.description = body.description?.trim() || null;
  if (body.point_price !== undefined) updateData.point_price = body.point_price;
  if (body.original_url !== undefined) updateData.original_url = body.original_url?.trim() || null;
  if (body.image_url !== undefined) updateData.image_url = body.image_url?.trim() || null;
  if (body.is_available !== undefined) updateData.is_available = body.is_available;

  const { data, error } = await adminSupabase
    .from('rewards_store')
    .update(updateData)
    .eq('id', productId)
    .select()
    .single();

  if (error) {
    console.error('Admin rewards product update error:', error);
    return NextResponse.json({ error: '상품 수정 중 오류가 발생했습니다.' }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ productId: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || !isAdmin(user.email)) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
  }

  const { productId } = await params;
  const adminSupabase = createAdminClient();

  // 진행 중인 주문 확인 (pending, preparing, shipped)
  const { count, error: countError } = await adminSupabase
    .from('reward_orders')
    .select('id', { count: 'exact', head: true })
    .eq('item_id', productId)
    .in('status', ['pending', 'preparing', 'shipped']);

  if (countError) {
    console.error('Admin rewards order check error:', countError);
    return NextResponse.json({ error: '주문 확인 중 오류가 발생했습니다.' }, { status: 500 });
  }

  if (count && count > 0) {
    return NextResponse.json(
      { error: `진행 중인 주문이 ${count}건 있어 삭제할 수 없습니다. 먼저 주문을 처리해주세요.` },
      { status: 400 }
    );
  }

  const { error } = await adminSupabase
    .from('rewards_store')
    .delete()
    .eq('id', productId);

  if (error) {
    console.error('Admin rewards product delete error:', error);
    return NextResponse.json({ error: '상품 삭제 중 오류가 발생했습니다.' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
