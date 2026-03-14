import { createClient } from '@/lib/supabase/server';
import { isAdmin, createAdminClient } from '@/lib/admin';
import { NextResponse } from 'next/server';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || !isAdmin(user.email)) {
    return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
  }

  const admin = createAdminClient();
  const { id } = await params;

  try {
    const [profileResult, membershipsResult, reportsResult, blacklistResult] = await Promise.all([
      admin
        .from('profiles')
        .select('*')
        .eq('id', id)
        .single(),

      admin
        .from('crew_members')
        .select('*, crew:crews!crew_id(id, title, category, status)')
        .eq('user_id', id)
        .order('created_at', { ascending: false }),

      admin
        .from('reports')
        .select('id, report_type, title, status, created_at, resolved_at')
        .eq('target_user_id', id)
        .order('created_at', { ascending: false }),

      admin
        .from('blacklist')
        .select('*')
        .eq('user_id', id)
        .maybeSingle(),
    ]);

    if (profileResult.error || !profileResult.data) {
      return NextResponse.json({ error: '해당 사용자를 찾을 수 없습니다.' }, { status: 404 });
    }

    return NextResponse.json({
      profile: profileResult.data,
      memberships: membershipsResult.data || [],
      reports: reportsResult.data || [],
      blacklist: blacklistResult.data || null,
    });
  } catch (error: unknown) {
    console.error('Admin user detail API error:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
