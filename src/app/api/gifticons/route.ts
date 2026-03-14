import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/admin';
import { isAdmin } from '@/lib/admin';
import { NextResponse } from 'next/server';

// GET /api/gifticons — 활성 상품 목록 + 재고 수 반환 (로그인 유저용)
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('gifticon_products')
    .select('id, name, brand, emoji, denomination, points_required')
    .eq('is_active', true)
    .order('denomination', { ascending: true });

  if (error) {
    return NextResponse.json({ error: '상품 목록 조회 중 오류가 발생했습니다.' }, { status: 500 });
  }

  // 각 상품의 재고 수 조회
  const productsWithStock = await Promise.all(
    (data || []).map(async (product) => {
      const { data: stockData } = await supabase
        .rpc('get_gifticon_stock', { p_product_id: product.id });
      return { ...product, stock: stockData ?? 0 };
    })
  );

  return NextResponse.json(productsWithStock);
}

// POST /api/gifticons — 관리자: 새 상품 추가
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || !isAdmin(user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { name, brand, emoji, denomination, points_required } = body;

    if (!name || !brand || !denomination || !points_required) {
      return NextResponse.json({ error: '필수 항목을 모두 입력해주세요.' }, { status: 400 });
    }

    const adminSupabase = createAdminClient();
    const { data, error } = await adminSupabase
      .from('gifticon_products')
      .insert({ name, brand, emoji: emoji || '🎁', denomination, points_required })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (error: unknown) {
    console.error('Gifticon product create error:', error);
    return NextResponse.json({ error: '상품 등록 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
