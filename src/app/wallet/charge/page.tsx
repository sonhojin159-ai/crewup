"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Bootpay } from "@bootpay/client-js";
import { createClient } from "@/lib/supabase/client";

const CHARGE_AMOUNTS = [1000, 5000, 10000, 50000];

type PaymentMethod = 'card' | 'kakaopay';

const PAYMENT_METHODS: { value: PaymentMethod; label: string; desc: string; icon: string }[] = [
  { value: 'card', label: '카드결제', desc: '토스페이먼츠', icon: '💳' },
  { value: 'kakaopay', label: '카카오페이', desc: '간편결제', icon: '🟡' },
];

export default function ChargePage() {
  const router = useRouter();
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card');
  const [isProcessing, setIsProcessing] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const fetchUser = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        if (profile) {
          setUser({ ...user, profile });
        }
      }
    };
    fetchUser();
  }, []);

  const handleAmountClick = (amount: number) => {
    setSelectedAmount(amount);
    setCustomAmount("");
  };

  const handleCustomAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/[^0-9]/g, "");
    setCustomAmount(rawValue);
    setSelectedAmount(null);
  };

  const currentAmount = selectedAmount || (customAmount ? parseInt(customAmount, 10) : 0);
  const isOverLimit = currentAmount > 500000;

  const handlePayment = async () => {
    if (!currentAmount || currentAmount < 1000) {
      alert("최소 충전 금액은 1,000P 입니다.");
      return;
    }

    if (isOverLimit) {
      alert("1回 최대 충전 한도는 500,000P 입니다.");
      return;
    }

    if (!user) {
      alert("로그인이 필요합니다.");
      return;
    }

    const applicationId = process.env.NEXT_PUBLIC_BOOTPAY_WEB_APPLICATION_ID;
    if (!applicationId) {
      alert("결제 설정이 올바르지 않습니다 (Application ID 누락).");
      return;
    }

    setIsProcessing(true);

    try {
      const orderId = `charge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // PG사 및 결제수단 설정
      const pgConfig = paymentMethod === 'kakaopay'
        ? { pg: 'kakaopay', method: '' }
        : { pg: 'tosspayments', method: 'card' };

      const payload: any = {
        application_id: applicationId,
        pg: pgConfig.pg,
        method: pgConfig.method,
        price: currentAmount,
        order_name: `포인트 충전 ${currentAmount}P`,
        order_id: orderId,
        tax_free: 0,
        user: {
          id: user.id,
          username: user.profile?.nickname || '회원',
          email: user.email || '',
        },
        items: [
          {
            id: 'point',
            name: `${currentAmount} 포인트`,
            qty: 1,
            price: currentAmount,
          }
        ],
        extra: {
          open_type: 'iframe',
          escrow: false,
          display_success_result: true,
          display_error_result: true,
        }
      };

      const response = await Bootpay.requestPayment(payload);

      if (response.event === 'done') {
        const res = await fetch('/api/payments/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            receiptId: response.receipt_id,
            orderId: orderId,
          })
        });

        const data = await res.json();
        if (res.ok && data.success) {
          alert("결제 처리 및 충전이 성공적으로 완료되었습니다.");
          router.push('/wallet');
        } else {
          throw new Error(data.error || '검증 실패: 결제는 승인되었으나 DB 충전에 실패했습니다.');
        }
      }
    } catch (e: any) {
      if (e.event === 'cancel') {
        alert("결제를 취소하셨습니다.");
      } else {
        alert("결제 중 오류가 발생했습니다: " + (e.message || '알 수 없는 오류'));
        console.error(e);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="mx-auto max-w-lg px-4 py-8 md:py-12">
        <h1 className="text-2xl font-bold text-foreground md:text-3xl text-center mb-8">포인트 충전</h1>

        <div className="rounded-2xl border border-neutral bg-surface p-6 shadow-sm">
          {/* 금액 선택 */}
          <p className="mb-4 text-sm font-medium text-foreground-muted">충전할 금액을 선택하세요</p>

          <div className="grid grid-cols-2 gap-3 mb-6">
            {CHARGE_AMOUNTS.map((amount) => (
              <button
                key={amount}
                onClick={() => handleAmountClick(amount)}
                className={`rounded-xl border p-4 text-center transition-all ${
                  selectedAmount === amount
                    ? "border-primary bg-primary/10 font-bold text-primary"
                    : "border-neutral hover:border-primary/50 hover:bg-neutral/20"
                }`}
              >
                {amount.toLocaleString()} P
              </button>
            ))}
          </div>

          <div className="mb-6">
            <label className="mb-2 block text-sm font-medium text-foreground-muted">직접 입력</label>
            <div className="relative">
              <input
                type="text"
                value={customAmount}
                onChange={handleCustomAmountChange}
                placeholder="원하시는 금액을 입력하세요"
                className="form-input pr-8 text-right font-medium"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 font-medium text-foreground-muted">P</span>
            </div>
            {customAmount && parseInt(customAmount, 10) < 1000 && (
              <p className="mt-2 text-xs text-primary">1,000P 이상부터 충전 가능합니다.</p>
            )}
            {isOverLimit && (
              <p className="mt-2 text-xs text-primary">1회 최대 500,000P까지 충전 가능합니다.</p>
            )}
          </div>

          {/* 결제수단 선택 */}
          <div className="mb-6">
            <p className="mb-3 text-sm font-medium text-foreground-muted">결제수단 선택</p>
            <div className="grid grid-cols-2 gap-3">
              {PAYMENT_METHODS.map((pm) => (
                <button
                  key={pm.value}
                  type="button"
                  onClick={() => setPaymentMethod(pm.value)}
                  className={`flex items-center gap-3 rounded-xl border p-4 transition-all ${
                    paymentMethod === pm.value
                      ? "border-primary bg-primary/10"
                      : "border-neutral hover:border-primary/50"
                  }`}
                >
                  <span className="text-2xl">{pm.icon}</span>
                  <div className="text-left">
                    <p className={`text-sm font-semibold ${paymentMethod === pm.value ? 'text-primary' : 'text-foreground'}`}>
                      {pm.label}
                    </p>
                    <p className="text-xs text-foreground-muted">{pm.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* 결제 */}
          <div className="border-t border-neutral pt-6">
            <div className="mb-6 flex items-end justify-between">
              <span className="font-medium text-foreground-muted">총 결제 금액</span>
              <div className="text-right">
                <span className="text-3xl font-extrabold text-foreground">{currentAmount.toLocaleString()}</span>
                <span className="ml-1 font-semibold text-foreground-muted">원</span>
              </div>
            </div>

            <button
              onClick={handlePayment}
              disabled={isProcessing || !currentAmount || currentAmount < 1000 || isOverLimit}
              className="btn-primary flex justify-center py-4 text-lg shadow-md disabled:bg-neutral disabled:opacity-50"
            >
              {isProcessing
                ? "결제창 호출 중..."
                : paymentMethod === 'kakaopay'
                  ? "카카오페이로 결제하기"
                  : "카드로 결제하기"
              }
            </button>
            <p className="mt-3 text-center text-xs text-foreground-muted">
              결제는 부트페이를 통해 안전하게 처리됩니다.
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
