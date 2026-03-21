"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { format } from "date-fns";

interface PointTransaction {
  id: string;
  created_at: string;
  note: string | null;
  amount: number;
  type: string;
}

export default function WalletPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"wallet" | "orders">("wallet");
  const [filter, setFilter] = useState<"all" | "earn" | "use">("all");

  const [wallet, setWallet] = useState<{ balance: number; escrow_balance: number; total_earned: number } | null>(null);
  const [transactions, setTransactions] = useState<PointTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/wallet'),
      fetch('/api/wallet/transactions?limit=50'),
    ]).then(async ([walletRes, txRes]) => {
      if (walletRes.ok) setWallet(await walletRes.json());
      if (txRes.ok) setTransactions((await txRes.json()).transactions || []);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const totalPoints = wallet?.balance || 0;
  const escrowBalance = wallet?.escrow_balance || 0;

  const filteredHistory = transactions.filter((tx) => {
    if (filter === "earn") return tx.amount > 0;
    if (filter === "use") return tx.amount < 0;
    return true;
  });

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-2xl font-bold text-foreground md:text-3xl">마이 월렛</h1>

        {/* Tab switcher */}
        <div className="mt-8 flex gap-4 border-b border-neutral">
          <button
            onClick={() => setActiveTab("wallet") }
            className={`pb-3 text-sm font-semibold transition-colors ${
              activeTab === "wallet" 
                ? "border-b-2 border-primary text-primary" 
                : "text-foreground-muted hover:text-foreground"
            }`}
          >
            포인트 관리
          </button>
          <button
            onClick={() => router.push('/rewards/orders')}
            className={`pb-3 text-sm font-semibold transition-colors text-foreground-muted hover:text-foreground`}
          >
            주문 내역
          </button>
        </div>

        {activeTab === "wallet" && (
          <div className="mt-6">
            {/* Point hero card */}
            <div className="card-hero">
              <p className="text-sm font-medium opacity-80">사용 가능 포인트</p>
              <p className="mt-2 text-4xl font-extrabold tracking-tight">
                {totalPoints.toLocaleString()}
                <span className="ml-1 text-xl font-semibold opacity-80">P</span>
              </p>
              <div className="mt-6">
                <div className="rounded-xl bg-white/15 px-4 py-3 backdrop-blur-sm">
                  <p className="text-xs opacity-70">에스크로 중 (미션 완료 시 지급)</p>
                  <p className="mt-1 text-lg font-bold">{escrowBalance.toLocaleString()}P</p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-4 flex gap-3">
              <button
                onClick={() => router.push('/wallet/charge')}
                className="flex-1 rounded-xl bg-primary py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-hover active:scale-95"
              >
                포인트 충전하기
              </button>
              <button
                onClick={() => router.push('/rewards')}
                className="flex-1 rounded-xl border border-primary py-3 text-sm font-semibold text-primary transition-colors hover:bg-primary/5 active:scale-95"
              >
                리워드 스토어
              </button>
            </div>

            {/* History section */}
            <div className="mt-10">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-foreground">포인트 내역</h2>
                <div className="flex gap-2">
                  {(["all", "earn", "use"] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      aria-pressed={filter === f}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                        filter === f
                          ? "bg-foreground text-background"
                          : "bg-neutral/20 text-foreground-muted hover:bg-neutral/40 hover:text-foreground"
                      }`}
                    >
                      {f === "all" ? "전체" : f === "earn" ? "적립" : "사용"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                {loading ? (
                  <div className="p-8 text-center text-sm text-foreground-muted">불러오는 중...</div>
                ) : filteredHistory.length === 0 ? (
                  <div className="rounded-xl border border-neutral bg-surface p-8 text-center">
                    <p className="text-sm text-foreground-muted">포인트 내역이 없습니다</p>
                    <p className="mt-1 text-xs text-foreground-muted">크루 활동으로 리워드를 모아보세요!</p>
                  </div>
                ) : (
                  filteredHistory.map((item) => {
                    const DEBIT_TYPES = ['entry_payment', 'forfeiture', 'reward_order'];
                    const displayAmount = DEBIT_TYPES.includes(item.type) ? -Math.abs(item.amount) : item.amount;
                    const label = item.note || (
                      item.type === 'charge' ? '포인트 충전' :
                      item.type === 'entry_payment' ? '크루 참여금' :
                      item.type === 'reward_order' ? '리워드 주문 차감' :
                      item.type === 'reward' ? '미션 달성 리워드' :
                      item.type === 'refund' ? '크루 해산 환급' :
                      item.type === 'escrow_release' ? '에스크로 지급' :
                      item.type
                    );
                    return (
                      <div key={item.id} className="flex items-center justify-between rounded-xl border border-neutral px-4 py-3">
                        <div>
                          <p className="text-sm font-medium text-foreground">{label}</p>
                          <p className="mt-0.5 text-xs text-foreground-muted">{format(new Date(item.created_at), 'yyyy.MM.dd')}</p>
                        </div>
                        <p className={`font-semibold ${displayAmount > 0 ? "text-success-text" : "text-primary"}`}>
                          {displayAmount > 0 ? "+" : ""}{displayAmount.toLocaleString()}P
                        </p>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 포인트 이용 안내 */}
      <div className="mx-auto max-w-3xl px-4 pb-8">
        <div className="rounded-2xl border border-neutral bg-surface p-6">
          <h2 className="text-lg font-bold text-foreground mb-4">포인트 이용 안내</h2>

          <div className="flex items-start gap-3 overflow-x-auto pb-2">
            {[
              { step: "1", label: "포인트 충전" },
              { step: "2", label: "크루 참여비 납부" },
              { step: "3", label: "미션 수행" },
              { step: "4", label: "리워드 포인트 적립" },
              { step: "5", label: "리워드 상품 교환" },
            ].map((item, idx) => (
              <div key={item.step} className="flex items-center gap-2 shrink-0">
                <div className="flex flex-col items-center text-center">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                    {item.step}
                  </span>
                  <span className="mt-1.5 text-xs font-medium text-foreground whitespace-nowrap">{item.label}</span>
                </div>
                {idx < 4 && (
                  <span className="text-foreground-muted text-lg mt-[-1rem]">&rarr;</span>
                )}
              </div>
            ))}
          </div>

          <ul className="mt-4 space-y-1 text-xs text-foreground-muted">
            <li>- 포인트 이용기간: 결제일로부터 1년</li>
            <li>- 포인트는 타인에게 양도 또는 매매할 수 없습니다</li>
            <li>- 리워드 상품은 주문 후 최대 6주 이내 배송됩니다</li>
          </ul>
        </div>
      </div>

      <Footer />
    </div>
  );
}
