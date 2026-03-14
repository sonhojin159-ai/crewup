import { createClient } from '@/lib/supabase/server';
import { isAdmin, createAdminClient } from '@/lib/admin';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || !isAdmin(user.email)) {
    return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
  }

  const admin = createAdminClient();

  try {
    const { data, error } = await admin
      .from('blacklist')
      .select(
        `*, profile:profiles!user_id(id, nickname, email), report:reports!report_id(id, title, report_type)`
      )
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Admin blacklist list error:', error);
      return NextResponse.json({ error: '블랙리스트 조회 중 오류가 발생했습니다.' }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (error: unknown) {
    console.error('Admin blacklist API error:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || !isAdmin(user.email)) {
    return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
  }

  const admin = createAdminClient();

  try {
    const body = await request.json();
    const { userId, reason, reportId, bannedUntil } = body;

    if (!userId || !reason?.trim()) {
      return NextResponse.json({ error: '사용자 ID와 사유는 필수입니다.' }, { status: 400 });
    }

    // 사용자 존재 확인
    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: '해당 사용자를 찾을 수 없습니다.' }, { status: 404 });
    }

    // 이미 블랙리스트인지 확인
    const { data: existing } = await admin
      .from('blacklist')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: '이미 블랙리스트에 등록된 사용자입니다.' }, { status: 409 });
    }

    const { data, error } = await admin
      .from('blacklist')
      .insert({
        user_id: userId,
        reason: reason.trim(),
        report_id: reportId || null,
        banned_until: bannedUntil || null,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error('Admin blacklist insert error:', error);
      return NextResponse.json({ error: '블랙리스트 등록 중 오류가 발생했습니다.' }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error: unknown) {
    console.error('Admin blacklist POST API error:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
