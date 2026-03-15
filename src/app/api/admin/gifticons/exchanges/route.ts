import { createAdminClient, isAdmin } from '@/lib/admin';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// GET /api/admin/gifticons/exchanges — 관리자: 전체 교환 내역 조회
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || !isAdmin(user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const adminSupabase = createAdminClient();

  const { data, error } = await adminSupabase
    .from('gifticon_exchanges')
    .select(`
      id,
      user_id,
      points_spent,
      code_revealed,
      created_at,
      profiles (
        email,
        nickname
      ),
      gifticon_products (
        name,
        brand
      )
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Admin gifticons history fetch error:', error);
    return NextResponse.json({ error: '교환 내역 조회 중 오류가 발생했습니다.' }, { status: 500 });
  }

  return NextResponse.json(data);
}
