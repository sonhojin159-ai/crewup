import { createAdminClient, isAdmin } from '@/lib/admin';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || !isAdmin(user.email)) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const keyPayload = serviceKey?.split('.')[1];
  const keyRole = keyPayload ? JSON.parse(Buffer.from(keyPayload, 'base64url').toString()).role : 'unknown';
  console.log('[DEBUG] service key role claim:', keyRole, 'length:', serviceKey?.length);

  const adminSupabase = createAdminClient();

  const { data, error } = await adminSupabase
    .from('rewards_store')
    .select('*')
    .order('created_at', { ascending: false });

  console.log('[DEBUG] rewards_store query - data count:', data?.length, 'error:', JSON.stringify(error));

  if (error) {
    console.error('Admin rewards products fetch error:', error);
    return NextResponse.json({ error: '상품 목록 조회 중 오류가 발생했습니다.' }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || !isAdmin(user.email)) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
  }

  let body: {
    title?: string;
    description?: string;
    point_price?: number;
    original_url?: string;
    image_url?: string;
    is_available?: boolean;
    category?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '잘못된 요청 형식입니다.' }, { status: 400 });
  }

  if (!body.title || typeof body.title !== 'string' || body.title.trim().length === 0) {
    return NextResponse.json({ error: '상품명은 필수입니다.' }, { status: 400 });
  }

  if (
    body.point_price === undefined ||
    typeof body.point_price !== 'number' ||
    !Number.isInteger(body.point_price) ||
    body.point_price <= 0
  ) {
    return NextResponse.json({ error: '포인트가는 양수 정수여야 합니다.' }, { status: 400 });
  }

  const category = body.category?.trim() || 'MISC';

  const adminSupabase = createAdminClient();

  const { data, error } = await adminSupabase
    .from('rewards_store')
    .insert({
      title: body.title.trim(),
      description: body.description?.trim() || null,
      point_price: body.point_price,
      original_url: body.original_url?.trim() || null,
      image_url: body.image_url?.trim() || null,
      is_available: body.is_available ?? true,
      category: category,
    })
    .select()
    .single();

  if (error) {
    console.error('Admin rewards product create error:', error);
    return NextResponse.json({ error: '상품 등록 중 오류가 발생했습니다.' }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
