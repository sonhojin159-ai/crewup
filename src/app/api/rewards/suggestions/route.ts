import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { rateLimitByUser } from '@/lib/rateLimit';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const { success: rlSuccess } = rateLimitByUser(user.id, 'reward-suggestion', 5, 60_000);
  if (!rlSuccess) {
    return NextResponse.json({ error: '잠시 후 다시 시도해주세요.' }, { status: 429 });
  }

  try {
    const { product_name, reason } = await request.json();

    if (!product_name?.trim()) {
      return NextResponse.json({ error: '상품명을 입력해주세요.' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('reward_suggestions')
      .insert({
        user_id: user.id,
        product_name: product_name.trim(),
        reason: reason?.trim() || '',
        status: 'pending'
      })
      .select()
      .single();

    if (error) {
      console.error('Reward suggestion insert error:', error);
      return NextResponse.json({ error: '제안 등록 중 오류가 발생했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error('Reward suggestion payload error:', err);
    return NextResponse.json({ error: '잘못된 요청 형식입니다.' }, { status: 400 });
  }
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('reward_suggestions')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Reward suggestions fetch error:', error);
    return NextResponse.json({ error: '제안 내역 조회 중 오류가 발생했습니다.' }, { status: 500 });
  }

  return NextResponse.json(data);
}
