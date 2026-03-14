import { createAdminClient, isAdmin } from '@/lib/admin';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// POST /api/gifticons/[productId]/codes — 관리자: 코드 업로드 (줄바꿈으로 구분)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ productId: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || !isAdmin(user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { productId } = await params;
  const body = await request.json();
  const rawCodes: string = body.codes || '';

  const codes = rawCodes
    .split('\n')
    .map((c: string) => c.trim())
    .filter((c: string) => c.length > 0);

  if (codes.length === 0) {
    return NextResponse.json({ error: '코드를 입력해주세요.' }, { status: 400 });
  }

  const adminSupabase = createAdminClient();

  // 상품 존재 확인
  const { data: product } = await adminSupabase
    .from('gifticon_products')
    .select('id')
    .eq('id', productId)
    .single();

  if (!product) {
    return NextResponse.json({ error: '상품을 찾을 수 없습니다.' }, { status: 404 });
  }

  const rows = codes.map((code: string) => ({ product_id: productId, code }));

  const { data, error } = await adminSupabase
    .from('gifticon_codes')
    .insert(rows)
    .select('id');

  if (error) {
    console.error('Code upload error:', error);
    return NextResponse.json({ error: '코드 업로드 중 오류가 발생했습니다. 중복 코드가 있는지 확인해주세요.' }, { status: 500 });
  }

  return NextResponse.json({ success: true, uploaded: data?.length ?? 0 });
}
