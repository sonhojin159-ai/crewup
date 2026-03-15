import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// GET /api/crews/[id]/reviews — 크루 리뷰 목록 조회
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('crew_reviews')
    .select(`
      *,
      profiles:reviewer_id (nickname, avatar_url)
    `)
    .eq('crew_id', id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Fetch reviews error:', error);
    return NextResponse.json({ error: '리뷰를 불러오는 중 오류가 발생했습니다.' }, { status: 500 });
  }

  return NextResponse.json(data);
}

// POST /api/crews/[id]/reviews — 리뷰 작성
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
    const { crew_rating, leader_rating, comment } = body;

    if (!crew_rating || !leader_rating) {
      return NextResponse.json({ error: '평점을 입력해주세요.' }, { status: 400 });
    }

    const crewRatingNum = Number(crew_rating);
    const leaderRatingNum = Number(leader_rating);
    if (!Number.isInteger(crewRatingNum) || crewRatingNum < 1 || crewRatingNum > 5 ||
        !Number.isInteger(leaderRatingNum) || leaderRatingNum < 1 || leaderRatingNum > 5) {
      return NextResponse.json({ error: '평점은 1~5 사이의 정수여야 합니다.' }, { status: 400 });
    }

    if (comment && comment.length > 500) {
      return NextResponse.json({ error: '리뷰 내용은 500자 이하여야 합니다.' }, { status: 400 });
    }

    // 1. 멤버십 확인 (active 상태인지)
    const { data: membership, error: memberError } = await supabase
      .from('crew_members')
      .select('status')
      .eq('crew_id', id)
      .eq('user_id', user.id)
      .single();

    if (memberError || !membership || membership.status !== 'active') {
      return NextResponse.json({ error: '활동 중인 크루 멤버만 리뷰를 작성할 수 있습니다.' }, { status: 403 });
    }

    // 2. 크루장 ID 조회
    const { data: crew, error: crewError } = await supabase
      .from('crews')
      .select('created_by')
      .eq('id', id)
      .single();

    if (crewError || !crew) {
      return NextResponse.json({ error: '크루 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    // 3. 리뷰 저장
    const { data, error } = await supabase
      .from('crew_reviews')
      .insert({
        crew_id: id,
        reviewer_id: user.id,
        leader_id: crew.created_by,
        crew_rating,
        leader_rating,
        comment
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: '이미 이 크루에 대한 리뷰를 작성하셨습니다.' }, { status: 400 });
      }
      throw error;
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    console.error('Review submission error:', error);
    return NextResponse.json({ error: '리뷰 저장 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
