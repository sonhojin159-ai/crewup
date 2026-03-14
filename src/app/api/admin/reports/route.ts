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
  const status = searchParams.get('status');
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 20));
  const offset = (page - 1) * limit;

  try {
    let query = admin
      .from('reports')
      .select(
        `*, reporter:profiles!reporter_id(id, nickname), target:profiles!target_user_id(id, nickname), crew:crews!crew_id(id, title)`,
        { count: 'exact' }
      );

    if (status) {
      query = query.eq('status', status);
    }

    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, count, error } = await query;

    if (error) {
      console.error('Admin reports list error:', error);
      return NextResponse.json({ error: '신고 목록 조회 중 오류가 발생했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ data: data || [], total: count || 0 });
  } catch (error: unknown) {
    console.error('Admin reports API error:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
