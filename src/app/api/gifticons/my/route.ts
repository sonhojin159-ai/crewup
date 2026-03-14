import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// GET /api/gifticons/my — 유저의 기프티콘 교환 내역(보관함) 조회
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('gifticon_exchanges')
    .select(`
      id,
      points_spent,
      code_revealed,
      created_at,
      gifticon_products (
        name,
        brand,
        emoji,
        denomination
      )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('My gifticons fetch error:', error);
    return NextResponse.json({ error: '보관함 조회 중 오류가 발생했습니다.' }, { status: 500 });
  }

  // 데이터 포맷팅
  const formattedData = (data || []).map((item: any) => ({
    id: item.id,
    points_spent: item.points_spent,
    code: item.code_revealed,
    created_at: item.created_at,
    product: item.gifticon_products
  }));

  return NextResponse.json(formattedData);
}
