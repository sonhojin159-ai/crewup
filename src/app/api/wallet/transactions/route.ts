import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('filter') || 'all';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10))); // m9 Fix: 1~100 상한
    const offset = (page - 1) * limit;

    try {
        let query = supabase
            .from('point_transactions')
            .select('*', { count: 'exact' })
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);
            
        if (filter === 'earn') {
            query = query.gt('amount', 0);
        } else if (filter === 'use') {
            query = query.lt('amount', 0);
        }

        const { data, error, count } = await query;

        if (error) throw error;

        return NextResponse.json({ transactions: data, count, page, limit });
    } catch (error: unknown) {
        console.error('Transactions fetch error:', error);
        return NextResponse.json({ error: '거래 내역 조회 중 오류가 발생했습니다.' }, { status: 500 });
    }
}
