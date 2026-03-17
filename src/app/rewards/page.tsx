"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { SuggestionModal } from "@/components/SuggestionModal";

interface RewardItem {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  point_price: number;
  is_available: boolean;
  category: string;
}

const CATEGORIES = [
  { value: "ALL", label: "전체" },
  { value: "FASHION", label: "패션/의류" },
  { value: "FOOD", label: "식품/음료" },
  { value: "IT", label: "IT/전자기기" },
  { value: "APPLIANCE", label: "가전제품" },
  { value: "MISC", label: "잡화/기타" },
] as const;

const PRICE_RANGES = [
  { value: "ALL", label: "전체 금액" },
  { value: "UNDER_10K", label: "1만 P 이하" },
  { value: "10K_50K", label: "1만 P ~ 5만 P" },
  { value: "50K_100K", label: "5만 P ~ 10만 P" },
  { value: "OVER_100K", label: "10만 P 이상" },
] as const;

type OrderStep = "idle" | "form" | "confirm";

export default function RewardsPage() {
  const [items, setItems] = useState<RewardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState(0);

  // 필터 상태
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [priceFilter, setPriceFilter] = useState<string>("ALL");

  // 주문 모달 상태
  const [selectedItem, setSelectedItem] = useState<RewardItem | null>(null);
  const [orderStep, setOrderStep] = useState<OrderStep>("idle");
  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [recipientAddress, setRecipientAddress] = useState("");
  const [consented, setConsented] = useState(false);
  const [ordering, setOrdering] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [orderSuccess, setOrderSuccess] = useState(false);

  // 제안 모달 상태
  const [isSuggestionOpen, setIsSuggestionOpen] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [itemsRes, walletRes] = await Promise.all([
        fetch("/api/rewards"),
        fetch("/api/wallet"),
      ]);
      if (itemsRes.ok) setItems(await itemsRes.json());
      if (walletRes.ok) {
        const w = await walletRes.json();
        setBalance(w.balance ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openOrderModal = (item: RewardItem) => {
    setSelectedItem(item);
    setOrderStep("form");
    setRecipientName("");
    setRecipientPhone("");
    setRecipientAddress("");
    setConsented(false);
    setOrderError(null);
    setOrderSuccess(false);
  };

  const closeModal = () => {
    setSelectedItem(null);
    setOrderStep("idle");
    setOrderError(null);
    setOrderSuccess(false);
  };

  const handleFormNext = () => {
    if (!recipientName.trim() || !recipientPhone.trim() || !recipientAddress.trim()) {
      setOrderError("모든 배송 정보를 입력해주세요.");
      return;
    }
    setOrderError(null);
    setOrderStep("confirm");
  };

  const handleOrder = async () => {
    if (!selectedItem || !consented || ordering) return;
    setOrdering(true);
    setOrderError(null);

    try {
      const res = await fetch("/api/rewards/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item_id: selectedItem.id,
          recipient_name: recipientName.trim(),
          recipient_phone: recipientPhone.trim(),
          recipient_address: recipientAddress.trim(),
          consented: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        console.error('Order API error:', { status: res.status, data });
        setOrderError(data.error || "주문에 실패했습니다.");
      } else {
        setOrderSuccess(true);
        setBalance((prev) => prev - (data.points_spent ?? selectedItem.point_price));
      }
    } catch {
      setOrderError("주문 처리 중 오류가 발생했습니다.");
    } finally {
      setOrdering(false);
    }
  };

  const filteredItems = items.filter((item) => {
    // 1. 카테고리 필터
    if (categoryFilter !== "ALL" && item.category !== categoryFilter) {
      return false;
    }
    // 2. 가격 필터
    if (priceFilter === "UNDER_10K" && item.point_price > 10000) return false;
    if (priceFilter === "10K_50K" && (item.point_price <= 10000 || item.point_price > 50000)) return false;
    if (priceFilter === "50K_100K" && (item.point_price <= 50000 || item.point_price > 100000)) return false;
    if (priceFilter === "OVER_100K" && item.point_price <= 100000) return false;

    return true;
  });

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="mx-auto max-w-4xl px-4 py-8">
        {/* 헤더 */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground md:text-3xl">
              PAPA&apos;s Pick 리워드 스토어
            </h1>
            <p className="mt-1 text-sm text-foreground-muted">
              적립한 포인트로 실물 상품을 주문하세요 (최대 6주 이내 배송 보장)
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary/10 px-4 py-2.5">
              <p className="text-xs text-primary/70">보유 포인트</p>
              <p className="text-lg font-bold text-primary">
                {balance.toLocaleString()}P
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setIsSuggestionOpen(true)}
                className="rounded-xl border border-primary bg-primary/5 px-4 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/10 whitespace-nowrap"
              >
                상품 제안하기 🎁
              </button>
              <Link
                href="/rewards/orders"
                className="rounded-xl border border-neutral px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-primary hover:text-primary whitespace-nowrap"
              >
                주문 내역
              </Link>
              <Link
                href="/wallet"
                className="rounded-xl border border-neutral px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-primary hover:text-primary whitespace-nowrap"
              >
                지갑으로 가기
              </Link>
            </div>
          </div>
        </div>

        {/* 필터 영역 */}
        <div className="mt-8 space-y-4">
          {/* 카테고리 탭 */}
          <div className="flex gap-1 overflow-x-auto pb-2 scrollbar-hide border-b border-neutral">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                onClick={() => setCategoryFilter(cat.value)}
                className={`flex-shrink-0 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${
                  categoryFilter === cat.value
                    ? "border-primary text-primary"
                    : "border-transparent text-foreground-muted hover:text-foreground hover:border-neutral/50"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* 가격대 필터 (Pills) */}
          <div className="flex flex-wrap gap-2">
            {PRICE_RANGES.map((range) => (
              <button
                key={range.value}
                onClick={() => setPriceFilter(range.value)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                  priceFilter === range.value
                    ? "bg-primary text-white"
                    : "bg-surface text-foreground-muted hover:bg-neutral/20 border border-neutral/50"
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>
        </div>

        {/* 상품 그리드 */}
        <div className="mt-6">
          {loading ? (
            <div className="p-12 text-center text-sm text-foreground-muted">불러오는 중...</div>
          ) : filteredItems.length === 0 ? (
            <div className="rounded-xl border border-neutral bg-surface p-12 text-center">
              <p className="text-foreground-muted">해당하는 상품이 없습니다</p>
              <p className="mt-1 text-xs text-foreground-muted">다른 필터를 선택하거나 모든 상품을 확인해보세요</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredItems.map((item) => {
                const canAfford = balance >= item.point_price;
                return (
                  <div
                    key={item.id}
                    className="overflow-hidden rounded-2xl border border-neutral bg-white transition-shadow hover:shadow-md"
                  >
                    {/* 이미지 */}
                    <div className="aspect-square bg-surface flex items-center justify-center relative">
                      {item.image_url ? (
                        <Image
                          src={item.image_url}
                          alt={item.title}
                          fill
                          className="object-cover"
                          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        />
                      ) : (
                        <span className="text-5xl text-foreground-muted/30">🎁</span>
                      )}
                    </div>

                    {/* 정보 */}
                    <div className="p-4">
                      <div className="mb-1.5 flex items-center justify-between">
                        <span className="inline-block rounded-md bg-neutral/10 px-2 py-0.5 text-[10px] font-medium text-foreground-muted">
                          {CATEGORIES.find(c => c.value === item.category)?.label || "분류없음"}
                        </span>
                      </div>
                      <h3 className="font-bold text-foreground leading-tight">{item.title}</h3>
                      {item.description && (
                        <p className="mt-1 text-xs text-foreground-muted line-clamp-2">
                          {item.description}
                        </p>
                      )}
                      <div className="mt-3 flex items-center justify-between">
                        <p className="text-lg font-bold text-primary">
                          {item.point_price.toLocaleString()}P
                        </p>
                        <button
                          onClick={() => openOrderModal(item)}
                          disabled={!canAfford}
                          className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                            canAfford
                              ? "bg-primary text-white hover:bg-primary-hover active:scale-95"
                              : "cursor-not-allowed bg-neutral/30 text-foreground-muted"
                          }`}
                        >
                          {canAfford ? "주문하기" : "포인트 부족"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 주문 모달 */}
      {selectedItem && orderStep !== "idle" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            {orderSuccess ? (
              /* 주문 완료 */
              <div className="text-center">
                <p className="text-4xl">🎉</p>
                <h3 className="mt-4 text-xl font-bold text-foreground">주문 완료!</h3>
                <p className="mt-2 text-sm text-foreground-muted">
                  {selectedItem.title} 주문이 접수되었습니다.
                </p>
                <p className="mt-1 text-xs text-foreground-muted">
                  관리자 확인 후 배송이 진행됩니다. 주문 내역에서 진행 상황을 확인하세요.
                </p>
                <div className="mt-6 flex gap-3">
                  <Link
                    href="/rewards/orders"
                    className="flex-1 rounded-xl bg-primary py-3 text-center text-sm font-semibold text-white hover:bg-primary-hover"
                  >
                    주문 내역 보기
                  </Link>
                  <button
                    onClick={closeModal}
                    className="flex-1 rounded-xl border border-neutral py-3 text-sm font-medium text-foreground hover:bg-neutral/10"
                  >
                    닫기
                  </button>
                </div>
              </div>
            ) : orderStep === "form" ? (
              /* Step 1: 배송지 입력 */
              <>
                <h3 className="text-lg font-bold text-foreground">배송 정보 입력</h3>
                <p className="mt-1 text-sm text-foreground-muted">
                  {selectedItem.title} ({selectedItem.point_price.toLocaleString()}P)
                </p>

                {orderError && (
                  <div className="mt-3 rounded-xl bg-red-500/10 p-3 text-sm font-medium text-red-500">
                    {orderError}
                  </div>
                )}

                <div className="mt-4 space-y-3">
                  <div>
                    <label className="form-label">수령인 이름</label>
                    <input
                      type="text"
                      value={recipientName}
                      onChange={(e) => setRecipientName(e.target.value)}
                      placeholder="홍길동"
                      className="form-input"
                    />
                  </div>
                  <div>
                    <label className="form-label">연락처</label>
                    <input
                      type="tel"
                      value={recipientPhone}
                      onChange={(e) => setRecipientPhone(e.target.value)}
                      placeholder="010-1234-5678"
                      className="form-input"
                    />
                  </div>
                  <div>
                    <label className="form-label">배송 주소</label>
                    <input
                      type="text"
                      value={recipientAddress}
                      onChange={(e) => setRecipientAddress(e.target.value)}
                      placeholder="서울시 강남구 테헤란로 123, 101동 1234호"
                      className="form-input"
                    />
                  </div>
                </div>

                <div className="mt-5 flex gap-3">
                  <button
                    onClick={closeModal}
                    className="flex-1 rounded-xl border border-neutral py-3 text-sm font-medium text-foreground hover:bg-neutral/10"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleFormNext}
                    className="flex-1 rounded-xl bg-primary py-3 text-sm font-semibold text-white hover:bg-primary-hover"
                  >
                    다음
                  </button>
                </div>
              </>
            ) : (
              /* Step 2: 동의 + 확인 */
              <>
                <h3 className="text-lg font-bold text-foreground">주문 확인</h3>

                {orderError && (
                  <div className="mt-3 rounded-xl bg-red-500/10 p-3 text-sm font-medium text-red-500">
                    {orderError}
                  </div>
                )}

                <div className="mt-4 space-y-2 rounded-xl bg-surface p-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-foreground-muted">상품</span>
                    <span className="font-medium text-foreground">{selectedItem.title}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-foreground-muted">차감 포인트</span>
                    <span className="font-bold text-primary">{selectedItem.point_price.toLocaleString()}P</span>
                  </div>
                  <hr className="border-neutral" />
                  <div className="flex justify-between">
                    <span className="text-foreground-muted">수령인</span>
                    <span className="text-foreground">{recipientName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-foreground-muted">연락처</span>
                    <span className="text-foreground">{recipientPhone}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-foreground-muted">주소</span>
                    <span className="text-foreground text-right max-w-[200px]">{recipientAddress}</span>
                  </div>
                </div>

                {/* 개인정보 제3자 제공 동의 */}
                <div className="mt-4 rounded-xl border border-neutral p-4">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={consented}
                      onChange={(e) => setConsented(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-neutral text-primary accent-primary"
                    />
                    <span className="text-xs leading-relaxed text-foreground-muted">
                      <span className="font-semibold text-foreground">[필수] 개인정보 제3자 제공 동의</span>
                      <br />
                      주문 처리를 위해 (주)신화캐슬에 이름, 연락처, 주소를 제공합니다.
                      제공된 정보는 배송 완료 후 30일 이내 파기됩니다.
                      <br />
                      <span className="text-primary font-medium mt-1 inline-block">* 본 서비스는 위탁 구매 대행으로, 최대 6주 이내 배송을 보장합니다.</span>
                    </span>
                  </label>
                </div>

                <div className="mt-5 flex gap-3">
                  <button
                    onClick={() => setOrderStep("form")}
                    className="flex-1 rounded-xl border border-neutral py-3 text-sm font-medium text-foreground hover:bg-neutral/10"
                  >
                    이전
                  </button>
                  <button
                    onClick={handleOrder}
                    disabled={!consented || ordering}
                    className={`flex-1 rounded-xl py-3 text-sm font-semibold transition-colors ${
                      consented && !ordering
                        ? "bg-primary text-white hover:bg-primary-hover"
                        : "cursor-not-allowed bg-neutral/30 text-foreground-muted"
                    }`}
                  >
                    {ordering ? "처리 중..." : `${selectedItem.point_price.toLocaleString()}P 결제하기`}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* 상품 제안 모달 */}
      <SuggestionModal 
        isOpen={isSuggestionOpen} 
        onClose={() => setIsSuggestionOpen(false)} 
      />

      <Footer />
    </div>
  );
}
