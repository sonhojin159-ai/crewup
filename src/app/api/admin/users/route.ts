import { createClient } from '@/lib/supabase/server';
import { isAdmin, createAdminClient } from '@/lib/admin';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || !isAdmin(user.email)) {
    return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
  }

  const admin = createAdminClient();
  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search');
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const limit = 20;
  const offset = (page - 1) * limit;

  try {
    if (search) {
      const { data: profiles, count, error: profileError } = await admin
        .from('profiles')
        .select('id, nickname, created_at', { count: 'exact' })
        .ilike('nickname', `%${search}%`)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (profileError) throw profileError;

      const users = await Promise.all(
        (profiles || []).map(async (p) => {
          const { data } = await admin.auth.admin.getUserById(p.id);
          return {
            id: p.id,
            nickname: p.nickname,
            email: data.user?.email || '',
            created_at: p.created_at,
          };
        })
      );

      return NextResponse.json({ data: users, total: count || 0 });
    } else {
      const { data: authData, error: authError } = await admin.auth.admin.listUsers({
        page,
        perPage: limit,
      });

      if (authError) throw authError;

      const userIds = authData.users.map((u) => u.id);
      const { data: profiles } = await admin
        .from('profiles')
        .select('id, nickname')
        .in('id', userIds);

      const profileMap = new Map(profiles?.map((p) => [p.id, p.nickname]) || []);

      const users = authData.users.map((u) => ({
        id: u.id,
        nickname: profileMap.get(u.id) || '(닉네임 없음)',
        email: u.email || '',
        created_at: u.created_at,
      }));

      return NextResponse.json({ data: users, total: authData.total });
    }
  } catch (error: unknown) {
    console.error('Admin users API error:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
