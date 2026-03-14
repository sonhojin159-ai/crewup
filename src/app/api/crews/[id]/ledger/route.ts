import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 멤버십 검증: 크루 멤버 또는 크루장만 장부 조회 가능
  const { data: crew } = await supabase
    .from('crews')
    .select('created_by')
    .eq('id', id)
    .single();

  const { data: membership } = await supabase
    .from('crew_members')
    .select('id')
    .eq('crew_id', id)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();

  if (!membership && crew?.created_by !== user.id) {
    return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
  }

  // Get date filter
  const { searchParams } = new URL(request.url);
  const dateStr = searchParams.get('date');

  let query = supabase
    .from('ledger_entries')
    .select(`
      *,
      profiles:created_by (nickname, avatar_url),
      ledger_approvals (user_id, approved, approved_at)
    `)
    .eq('crew_id', id)
    .order('date', { ascending: false });

  if (dateStr) {
    query = query.eq('date', dateStr);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Ledger fetch error:', error);
    return NextResponse.json({ error: '장부 조회 중 오류가 발생했습니다.' }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { date, revenue, expense, description, evidence_urls } = body;

    if (!date) {
      return NextResponse.json({ error: '날짜는 필수입니다.' }, { status: 400 });
    }

    // 크루장 여부 확인 (RLS에서도 체크하지만, 명확한 에러 메시지를 위해 추가 확인)
    const { data: crew } = await supabase
      .from('crews')
      .select('created_by, track')
      .eq('id', id)
      .single();

    if (!crew || crew.track !== 'revenue_share') {
      return NextResponse.json({ error: '수익 분배형 크루만 장부를 작성할 수 있습니다.' }, { status: 400 });
    }

    if (crew.created_by !== user.id) {
      return NextResponse.json({ error: '크루장만 장부를 작성할 수 있습니다.' }, { status: 403 });
    }

    // 장부 작성 (기존에 같은 날짜의 장부가 있다면 실패함 - DB UNIQUE 제약조건)
    const { data: entry, error: insertError } = await supabase
      .from('ledger_entries')
      .insert({
        crew_id: id,
        date,
        revenue: Number(revenue) || 0,
        expense: Number(expense) || 0,
        description: description || '',
        evidence_urls: evidence_urls || [],
        created_by: user.id,
      })
      .select()
      .single();

    if (insertError) {
      if (insertError.code === '23505') {
        return NextResponse.json({ error: '해당 날짜에 이미 장부가 존재합니다.' }, { status: 409 });
      }
      throw insertError;
    }

    // 작성자(크루장) 본인은 자동으로 동의 처리
    await supabase.from('ledger_approvals').insert({
      entry_id: entry.id,
      user_id: user.id,
      approved: true,
    });

    return NextResponse.json(entry, { status: 201 });
  } catch (error: unknown) {
    console.error('Ledger creation error:', error);
    return NextResponse.json({ error: '장부 작성 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
