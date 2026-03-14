import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { RestClient } from '@bootpay/server-rest-client';
import { rateLimitByUser } from '@/lib/rateLimit';

export async function POST(req: Request) {
  try {
    const { receiptId, orderId } = await req.json();

    if (!receiptId || !orderId) {
      return NextResponse.json({ success: false, error: '필수 파라미터가 누락되었습니다.' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: '인증 세션이 만료되었습니다. 다시 로그인해 주세요.' }, { status: 401 });
    }

    // Rate Limiting: 결제 확인은 분당 5회로 제한
    const { success: rlSuccess } = rateLimitByUser(user.id, 'payment-confirm', 5, 60_000);
    if (!rlSuccess) {
      return NextResponse.json({ success: false, error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' }, { status: 429 });
    }

    const restAppId = process.env.BOOTPAY_REST_APPLICATION_ID;
    const privateKey = process.env.BOOTPAY_PRIVATE_KEY;

    if (!restAppId || !privateKey) {
      console.error('Bootpay API Keys not configured.');
      return NextResponse.json({ success: false, error: '서버 결제 설정 오류입니다.' }, { status: 500 });
    }

    // 1. 부트페이 검증 (Receipt)
    RestClient.setConfig(
      restAppId,
      privateKey
    );
    await RestClient.getAccessToken(); // 토큰 발급 (캐싱은 라이브러리 내부 처리)

    const verifyResponse = await RestClient.verify(receiptId);

    if (verifyResponse.status !== 200) {
      return NextResponse.json({ success: false, error: '부트페이 통신 중 오류가 발생했습니다.' }, { status: 500 });
    }

    const receiptData = verifyResponse.data;

    // 결제 완료 상태(status === 1)인지 확인
    if (receiptData.status !== 1) {
      return NextResponse.json({ success: false, error: '완료된 결제가 아닙니다 (status !== 1).' }, { status: 400 });
    }

    // 2. 금액 및 영수증 번호 추출
    const amount = receiptData.price;
    const verifiedReceiptId = receiptData.receipt_id;

    // 3. Supabase RPC 호출로 포인트 충전 (트랜잭션 안전성 보장)
    const { error: rpcError } = await supabase.rpc('process_charge_payment', {
      p_user_id: user.id, // [SEC-01] 세션의 user.id 사용
      p_amount: amount,
      p_receipt_id: verifiedReceiptId
    });

    if (rpcError) {
      console.error('RPC Error processing charge point:', rpcError);
      return NextResponse.json({ success: false, error: '포인트 지급 중 오류가 발생했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: '결제 및 포인트 충전이 성공적으로 완료되었습니다.' });

  } catch (error: unknown) {
    console.error('Payment confirm API error:', error);
    return NextResponse.json({ success: false, error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
