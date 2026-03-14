import { createClient } from '@/lib/supabase/server';
import { isAdmin, createAdminClient } from '@/lib/admin';
import { NextResponse } from 'next/server';

const VALID_STATUSES = ['pending', 'reviewing', 'resolved', 'dismissed'] as const;

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
    const { data, error } = await admin
      .from('reports')
      .select(
        `*, reporter:profiles!reporter_id(id, nickname, email), target:profiles!target_user_id(id, nickname, email), crew:crews!crew_id(id, title, category, status)`
      )
      .eq('id', id)
      .single();

    if (error) {
      console.error('Admin report detail error:', error);
      return NextResponse.json({ error: '신고 상세 조회 중 오류가 발생했습니다.' }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: '해당 신고를 찾을 수 없습니다.' }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error: unknown) {
    console.error('Admin report detail API error:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
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
    const body = await request.json();
    const { status, adminNote } = body;

    const update: Record<string, string> = {};

    if (status !== undefined) {
      if (!VALID_STATUSES.includes(status)) {
        return NextResponse.json({ error: '유효하지 않은 상태값입니다.' }, { status: 400 });
      }
      update.status = status;

      if (status === 'resolved' || status === 'dismissed') {
        update.resolved_at = new Date().toISOString();
      }
    }

    if (adminNote !== undefined) {
      update.admin_note = adminNote;
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: '변경할 내용이 없습니다.' }, { status: 400 });
    }

    const { data, error } = await admin
      .from('reports')
      .update(update)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Admin report update error:', error);
      return NextResponse.json({ error: '신고 상태 변경 중 오류가 발생했습니다.' }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: '해당 신고를 찾을 수 없습니다.' }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error: unknown) {
    console.error('Admin report update API error:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
