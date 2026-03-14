import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id, nickname, avatar_url, role_type, created_at')
    .eq('id', user.id)
    .single();

  if (error) {
    return NextResponse.json({ error: '프로필 조회 중 오류가 발생했습니다.' }, { status: 500 });
  }

  // 크루장 평점 정보 가져오기
  const { data: reputation } = await supabase
    .from('leader_reputation')
    .select('avg_rating, review_count')
    .eq('leader_id', user.id)
    .single();

  return NextResponse.json({ 
    ...data, 
    email: user.email,
    reputation: reputation || { avg_rating: 0, review_count: 0 }
  });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { nickname, role_type } = body;

    if (nickname !== undefined) {
      if (!nickname || nickname.trim().length < 2 || nickname.trim().length > 20) {
        return NextResponse.json({ error: '닉네임은 2자 이상 20자 이하여야 합니다.' }, { status: 400 });
      }
    }

    const updates: Record<string, string> = {};
    if (nickname) updates.nickname = nickname.trim();
    if (role_type) updates.role_type = role_type;

    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id);

    if (error) throw error;

    // Supabase Auth user_metadata도 업데이트
    if (nickname) {
      await supabase.auth.updateUser({
        data: { nickname: nickname.trim() },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Profile update error:', error);
    return NextResponse.json({ error: '프로필 업데이트 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
