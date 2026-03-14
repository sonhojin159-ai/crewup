import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { data, error } = await supabase
            .from('user_points')
            .select('balance, escrow_balance, total_earned')
            .eq('user_id', user.id)
            .single();

        if (error) {
            // If the record doesn't exist yet, return 0s instead of failing
            if (error.code === 'PGRST116') {
                return NextResponse.json({ balance: 0, escrow_balance: 0, total_earned: 0 });
            }
            throw error;
        }

        return NextResponse.json(data);
    } catch (error: unknown) {
        console.error('Wallet fetch error:', error);
        return NextResponse.json({ error: '지갑 정보 조회 중 오류가 발생했습니다.' }, { status: 500 });
    }
}
