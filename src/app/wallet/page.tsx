"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

interface PointTransaction {
  id: string;
  created_at: string;
  note: string | null;
  amount: number;
  type: string;
}

export default function WalletPage() {
  const router = useRouter();
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

        {/* Point hero card */}
        <div className="card-hero mt-6">
          <p className="text-sm font-medium opacity-80">사용 가능 포인트</p>
          <p className="mt-2 text-4xl font-extrabold tracking-tight">
            {totalPoints.toLocaleString()}
            <span className="ml-1 text-xl font-semibold opacity-80">P</span>
          </p>
          <div className="mt-6 grid grid-cols-2 gap-4">
            <div className="rounded-xl bg-white/15 px-4 py-3 backdrop-blur-sm">
              <p className="text-xs opacity-70">에스크로 중 (출금 불가)</p>
              <p className="mt-1 text-lg font-bold">{escrowBalance.toLocaleString()}P</p>
            </div>
            <div className="rounded-xl bg-white/15 px-4 py-3 backdrop-blur-sm">
              <p className="text-xs opacity-70">누적 수령 리워드</p>
              <p className="mt-1 text-lg font-bold">{(wallet?.total_earned ?? 0).toLocaleString()}P</p>
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
        <div className="mt-8">
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
                <p className="mt-1 text-xs text-foreground-muted">포인트를 충전하거나 크루 미션을 완료해보세요</p>
              </div>
            ) : (
              filteredHistory.map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-xl border border-neutral px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {item.note || (
                        item.type === 'charge' ? '포인트 충전' :
                        item.type === 'entry_payment' ? '크루 참여금' :
                        item.type === 'gifticon' || item.type === 'reward_order' ? '리워드 주문' :
                        item.type
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-foreground-muted">{new Date(item.created_at).toLocaleDateString()}</p>
                  </div>
                  <p className={`font-semibold ${item.amount > 0 ? "text-success-text" : "text-primary"}`}>
                    {item.amount > 0 ? "+" : ""}{item.amount.toLocaleString()}P
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
