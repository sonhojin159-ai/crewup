"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

interface RewardOrder {
  id: string;
  points_spent: number;
  status: string;
  tracking_number: string | null;
  created_at: string;
  rewards_store: {
    title: string;
    image_url: string | null;
    point_price: number;
  } | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: "결제완료", color: "bg-yellow-100 text-yellow-700" },
  preparing: { label: "준비중", color: "bg-blue-100 text-blue-700" },
  shipped: { label: "배송중", color: "bg-purple-100 text-purple-700" },
  delivered: { label: "배송완료", color: "bg-green-100 text-green-700" },
  cancelled: { label: "취소됨", color: "bg-red-100 text-red-600" },
};

export default function RewardOrdersPage() {
  const [orders, setOrders] = useState<RewardOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const res = await fetch("/api/rewards/orders");
        if (res.ok) setOrders(await res.json());
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">주문 내역</h1>
          <Link
            href="/rewards"
            className="text-sm font-medium text-primary hover:underline"
          >
            스토어로 돌아가기
          </Link>
        </div>

        <div className="mt-6 space-y-3">
          {loading ? (
            <div className="p-12 text-center text-sm text-foreground-muted">불러오는 중...</div>
          ) : orders.length === 0 ? (
            <div className="rounded-xl border border-neutral bg-surface p-12 text-center">
              <p className="text-foreground-muted">주문 내역이 없습니다</p>
              <p className="mt-1 text-xs text-foreground-muted">리워드 스토어에서 상품을 주문해보세요</p>
              <Link
                href="/rewards"
                className="mt-4 inline-block rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-hover"
              >
                스토어 가기
              </Link>
            </div>
          ) : (
            orders.map((order) => {
              const statusCfg = STATUS_CONFIG[order.status] ?? { label: order.status, color: "bg-neutral/20 text-foreground-muted" };
              return (
                <div
                  key={order.id}
                  className="rounded-2xl border border-neutral bg-white p-5"
                >
                  <div className="flex items-start gap-4">
                    {/* 이미지 */}
                    <div className="h-16 w-16 shrink-0 rounded-xl bg-surface flex items-center justify-center overflow-hidden">
                      {order.rewards_store?.image_url ? (
                        <img
                          src={order.rewards_store.image_url}
                          alt={order.rewards_store.title ?? ""}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-2xl text-foreground-muted/30">🎁</span>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-bold text-foreground truncate">
                          {order.rewards_store?.title ?? "삭제된 상품"}
                        </h3>
                        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${statusCfg.color}`}>
                          {statusCfg.label}
                        </span>
                      </div>
                      <p className="mt-1 text-sm font-semibold text-primary">
                        {order.points_spent.toLocaleString()}P
                      </p>
                      <p className="mt-0.5 text-xs text-foreground-muted">
                        {new Date(order.created_at).toLocaleDateString("ko-KR", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </p>
                      {order.tracking_number && (
                        <p className="mt-2 text-xs text-foreground-muted">
                          송장번호:{" "}
                          <span className="font-mono font-medium text-foreground">
                            {order.tracking_number}
                          </span>
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
}
