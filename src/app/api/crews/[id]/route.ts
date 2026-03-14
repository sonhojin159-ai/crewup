import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const resolvedParams = await params;
    const id = resolvedParams.id;

    const supabase = await createClient();

    const { data, error } = await supabase
        .from('crews')
        .select('*, profiles:created_by(id, nickname, avatar_url), crew_members(id, status, user_id, profiles(id, nickname, avatar_url))')
        .eq('id', id)
        .single();

    if (error) {
        console.error('Crew detail fetch error:', error);
        return NextResponse.json({ error: '크루를 찾을 수 없습니다.' }, { status: 404 });
    }

    return NextResponse.json(data);
}
