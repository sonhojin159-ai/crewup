"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

type Tab = "history" | "shop" | "inventory";

interface PointTransaction {
  id: string;
  created_at: string;
  note: string | null;
  amount: number;
  type: string;
}

interface GifticonProduct {
  id: string;
  name: string;
  brand: string;
  emoji: string;
  denomination: number;
  points_required: number;
  stock: number;
}

interface ExchangeResult {
  productName: string;
  code: string;
}

export default function WalletPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("history");
  const [filter, setFilter] = useState<"all" | "earn" | "use">("all");

  const [wallet, setWallet] = useState<{ balance: number; escrow_balance: number; total_earned: number } | null>(null);
  const [transactions, setTransactions] = useState<PointTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  // 기프티콘 관련 상태
  const [gifticons, setGifticons] = useState<GifticonProduct[]>([]);
  const [gifticonLoading, setGifticonLoading] = useState(false);
  const [exchangeResult, setExchangeResult] = useState<ExchangeResult | null>(null);
  const [exchangingId, setExchangingId] = useState<string | null>(null);
  const [exchangeError, setExchangeError] = useState<string | null>(null);

  // 보관함 관련 상태
  const [inventory, setInventory] = useState<any[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);

  const fetchWalletData = async () => {
    try {
      const [walletRes, txRes] = await Promise.all([
        fetch('/api/wallet'),
        fetch('/api/wallet/transactions?limit=50'),
      ]);
      if (walletRes.ok) setWallet(await walletRes.json());
      if (txRes.ok) setTransactions((await txRes.json()).transactions || []);
    } catch (error) {
      console.error('Failed to fetch wallet data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchWalletData(); }, []);

  const fetchGifticons = async () => {
    setGifticonLoading(true);
    try {
      const res = await fetch('/api/gifticons');
      if (res.ok) setGifticons(await res.json());
    } finally {
      setGifticonLoading(false);
    }
  };

  const fetchInventory = async () => {
    setInventoryLoading(true);
    try {
      const res = await fetch('/api/gifticons/my');
      if (res.ok) setInventory(await res.json());
    } finally {
      setInventoryLoading(false);
    }
  };

  const handleTabChange = (t: Tab) => {
    setTab(t);
    if (t === "shop" && gifticons.length === 0) fetchGifticons();
    if (t === "inventory") fetchInventory();
  };

  const handleExchange = async (product: GifticonProduct) => {
    if (exchangingId) return;
    setExchangeError(null);
    setExchangingId(product.id);
    try {
      const res = await fetch(`/api/gifticons/${product.id}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setExchangeError(data.error || "교환에 실패했습니다.");
      } else {
        setExchangeResult({ productName: data.productName, code: data.code });
        fetchWalletData(); // 잔액 갱신
        fetchGifticons();  // 재고 갱신
      }
    } catch {
      setExchangeError("교환 중 오류가 발생했습니다.");
    } finally {
      setExchangingId(null);
    }
  };

  const totalPoints = wallet?.balance || 0;
  const escrowBalance = wallet?.escrow_balance || 0;

  const filteredHistory = transactions.filter((tx) => {
    if (filter === "all") return true;
    if (filter === "earn") return tx.amount > 0;
    if (filter === "use") return tx.amount < 0;
    return true;
  });

  // 브랜드별 그룹핑
  const brands = Array.from(new Set(gifticons.map(g => g.brand)));

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
        </div>

        {/* Tabs */}
        <div className="mt-8 flex gap-1 border-b border-neutral" role="tablist">
          {(["history", "shop", "inventory"] as const).map((t) => (
            <button
              key={t}
              onClick={() => {
                if (t === "shop") {
                  router.push("/rewards");
                } else if (t === "inventory") {
                  router.push("/rewards/orders");
                } else {
                  handleTabChange(t);
                }
              }}
              role="tab"
              aria-selected={tab === t}
              className={`tab-btn ${tab === t ? "tab-btn-active" : ""}`}
            >
              {t === "history" ? "포인트 내역" : t === "shop" ? "리워드 스토어" : "주문 내역"}
            </button>
          ))}
        </div>

        {/* History tab */}
        {tab === "history" && (
          <div className="mt-4" role="tabpanel">
            <div className="mb-4 flex gap-2">
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
        )}

        {/* Shop tab */}
        {tab === "shop" && (
          <div className="mt-4" role="tabpanel">
            {/* 교환 에러 */}
            {exchangeError && (
              <div className="mb-4 rounded-xl bg-red-500/10 p-4 text-sm text-red-500 font-medium">
                {exchangeError}
              </div>
            )}

            {gifticonLoading ? (
              <div className="p-8 text-center text-sm text-foreground-muted">불러오는 중...</div>
            ) : gifticons.length === 0 ? (
              <div className="rounded-xl border border-neutral bg-surface p-8 text-center">
                <p className="text-sm text-foreground-muted">교환 가능한 기프티콘이 없습니다</p>
                <p className="mt-1 text-xs text-foreground-muted">곧 다양한 기프티콘이 추가될 예정입니다</p>
              </div>
            ) : (
              <div className="space-y-8">
                {brands.map((brand) => (
                  <div key={brand}>
                    <h3 className="text-base font-bold text-foreground mb-3 flex items-center gap-2">
                      <span className="text-xl">{gifticons.find(g => g.brand === brand)?.emoji}</span>
                      {brand}
                    </h3>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {gifticons.filter(g => g.brand === brand).map((item) => {
                        const canAfford = totalPoints >= item.points_required;
                        const inStock = item.stock > 0;
                        const isExchanging = exchangingId === item.id;
                        return (
                          <div
                            key={item.id}
                            className="flex items-center gap-4 rounded-xl border border-neutral bg-white p-4"
                          >
                            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-surface text-2xl">
                              {item.emoji}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="truncate font-medium text-foreground text-sm">{item.name}</p>
                              <p className="mt-0.5 text-sm font-semibold text-primary">
                                {item.points_required.toLocaleString()}P
                              </p>
                              <p className="mt-0.5 text-xs text-foreground-muted">
                                {inStock ? `재고 ${item.stock}개` : "품절"}
                              </p>
                            </div>
                            <button
                              disabled={!canAfford || !inStock || !!exchangingId}
                              onClick={() => handleExchange(item)}
                              className={`shrink-0 rounded-xl px-4 py-2.5 text-xs font-semibold transition-colors ${
                                canAfford && inStock && !exchangingId
                                  ? "bg-primary text-white hover:bg-primary-hover active:scale-95"
                                  : "cursor-not-allowed bg-neutral/30 text-foreground-muted"
                              }`}
                            >
                              {isExchanging ? "처리중..." : !inStock ? "품절" : !canAfford ? "포인트 부족" : "교환"}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Inventory tab */}
        {tab === "inventory" && (
          <div className="mt-4" role="tabpanel">
            {inventoryLoading ? (
              <div className="p-8 text-center text-sm text-foreground-muted">불러오는 중...</div>
            ) : inventory.length === 0 ? (
              <div className="rounded-xl border border-neutral bg-surface p-8 text-center">
                <p className="text-sm text-foreground-muted">구매한 기프티콘이 없습니다</p>
                <p className="mt-1 text-xs text-foreground-muted">포인트로 기프티콘을 교환해보세요</p>
              </div>
            ) : (
              <div className="space-y-4">
                {inventory.map((item: any) => (
                  <div key={item.id} className="rounded-2xl border border-neutral bg-white p-5">
                    <div className="flex items-center gap-4">
                      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-surface text-2xl">
                        {item.product.emoji}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-foreground-muted">{item.product.brand}</p>
                        <p className="truncate font-bold text-foreground">{item.product.name}</p>
                        <p className="mt-0.5 text-xs text-foreground-muted">구매일: {new Date(item.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    
                    <div className="mt-4 rounded-xl bg-surface border border-dashed border-neutral p-4 flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="text-[10px] uppercase tracking-wider text-foreground-muted mb-0.5 font-bold">Gifticon Code</p>
                        <p className="font-mono text-sm font-bold text-primary truncate">{item.code}</p>
                      </div>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(item.code);
                          alert('코드가 복사되었습니다.');
                        }}
                        className="ml-4 shrink-0 rounded-lg bg-neutral/10 px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-neutral/20 transition-colors"
                      >
                        복사
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 교환 완료 모달 — 코드 표시 */}
      {exchangeResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl">
            <p className="text-4xl">🎉</p>
            <h3 className="mt-4 text-xl font-bold text-foreground">교환 완료!</h3>
            <p className="mt-2 text-sm text-foreground-muted">{exchangeResult.productName}</p>

            <div className="mt-5 rounded-xl bg-surface border border-neutral px-4 py-4">
              <p className="text-xs text-foreground-muted mb-1">기프티콘 코드</p>
              <p className="font-mono text-lg font-bold text-primary tracking-widest break-all">
                {exchangeResult.code}
              </p>
            </div>
            <p className="mt-3 text-xs text-foreground-muted">
              ⚠️ 이 코드는 지금만 확인할 수 있습니다. 반드시 복사해두세요.
            </p>
            <button
              onClick={() => {
                navigator.clipboard?.writeText(exchangeResult.code);
                setExchangeResult(null);
              }}
              className="mt-5 btn-primary w-full"
            >
              코드 복사 후 닫기
            </button>
            <button onClick={() => setExchangeResult(null)} className="mt-2 text-xs text-foreground-muted hover:text-foreground">
              그냥 닫기
            </button>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
