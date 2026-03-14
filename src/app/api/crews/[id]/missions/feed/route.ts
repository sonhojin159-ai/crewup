import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { id } = await params;

        // W2 Fix: 해당 크루 액티브 멤버인지 확인
        const { data: membership } = await supabase
            .from('crew_members')
            .select('id')
            .eq('crew_id', id)
            .eq('user_id', user.id)
            .in('status', ['active', 'owner'])
            .maybeSingle();

        if (!membership) {
            return NextResponse.json({ error: '크루 멤버만 인증 피드를 조회할 수 있습니다.' }, { status: 403 });
        }

        const { data, error } = await supabase
            .from('mission_submissions')
            .select('*, profiles:submitted_by(nickname, avatar_url), missions:mission_id(title)')
            .eq('crew_id', id)
            .order('created_at', { ascending: false })
            .limit(20);

        if (error) {
            console.error('Mission feed fetch error:', error);
            return NextResponse.json({ error: '인증 피드 조회 중 오류가 발생했습니다.' }, { status: 500 });
        }

        return NextResponse.json(data || []);

    } catch (error: unknown) {
        console.error('Mission feed error:', error);
        return NextResponse.json({ error: '인증 피드 조회 중 오류가 발생했습니다.' }, { status: 500 });
    }
}
