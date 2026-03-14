import { createClient } from '@/lib/supabase/server';
import { createAdminClient, isAdmin } from '@/lib/admin';
import { NextResponse } from 'next/server';
import { rateLimitByUser } from '@/lib/rateLimit';

// POST /api/gifticons/[productId]/exchange — 포인트로 기프티콘 교환
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ productId: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { success: rlSuccess } = rateLimitByUser(user.id, 'gifticon-exchange', 5, 60_000);
  if (!rlSuccess) {
    return NextResponse.json({ error: '잠시 후 다시 시도해주세요.' }, { status: 429 });
  }

  const { productId } = await params;

  const { data, error } = await supabase.rpc('process_gifticon_exchange', {
    p_user_id: user.id,
    p_product_id: productId,
  });

  if (error) {
    console.error('Gifticon exchange RPC error:', error);
    return NextResponse.json({ error: '교환 중 오류가 발생했습니다.' }, { status: 500 });
  }

  if (!data.success) {
    return NextResponse.json({ error: data.error }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    code: data.code,
    productName: data.product_name,
    message: `${data.product_name} 코드가 발급되었습니다.`,
  });
}

// GET /api/gifticons/[productId]/codes — 관리자: 해당 상품의 코드 목록 조회
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ productId: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || !isAdmin(user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { productId } = await params;
  const adminSupabase = createAdminClient();

  const { data, error } = await adminSupabase
    .from('gifticon_codes')
    .select('id, code, status, issued_to, issued_at, created_at')
    .eq('product_id', productId)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: '코드 목록 조회 중 오류가 발생했습니다.' }, { status: 500 });
  }

  return NextResponse.json(data);
}

// POST used for exchange above; add DELETE for admin product toggle
