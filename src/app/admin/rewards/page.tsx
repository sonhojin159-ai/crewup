"use client";

import { useState, useEffect, useCallback } from "react";

interface RewardOrder {
  id: string;
  user_id: string;
  recipient_name: string;
  recipient_phone: string;
  recipient_address: string;
  points_spent: number;
  status: string;
  tracking_number: string | null;
  admin_memo: string | null;
  consented_at: string;
  created_at: string;
  updated_at: string;
  address_deleted_at: string | null;
  profiles: { nickname: string | null; email: string | null } | null;
  rewards_store: {
    title: string;
    image_url: string | null;
    point_price: number;
    original_url: string | null;
  } | null;
}

const STATUS_TABS = [
  { value: "all", label: "전체" },
  { value: "pending", label: "결제완료" },
  { value: "preparing", label: "준비중" },
  { value: "shipped", label: "배송중" },
  { value: "delivered", label: "배송완료" },
  { value: "cancelled", label: "취소" },
] as const;

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  pending: { label: "결제완료", color: "bg-yellow-100 text-yellow-700" },
  preparing: { label: "준비중", color: "bg-blue-100 text-blue-700" },
  shipped: { label: "배송중", color: "bg-purple-100 text-purple-700" },
  delivered: { label: "배송완료", color: "bg-green-100 text-green-700" },
  cancelled: { label: "취소", color: "bg-red-100 text-red-600" },
};

export default function AdminRewardsPage() {
  const [orders, setOrders] = useState<RewardOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");

  // 처리 모달 상태
  const [editOrder, setEditOrder] = useState<RewardOrder | null>(null);
  const [editStatus, setEditStatus] = useState("");
  const [editTracking, setEditTracking] = useState("");
  const [editMemo, setEditMemo] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  const fetchOrders = useCallback(async (status: string) => {
    setLoading(true);
    try {
      const params = status !== "all" ? `?status=${status}` : "";
      const res = await fetch(`/api/admin/rewards/orders${params}`);
      if (res.ok) setOrders(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchOrders(statusFilter); }, [fetchOrders, statusFilter]);

  const openEditModal = (order: RewardOrder) => {
    setEditOrder(order);
    setEditStatus(order.status);
    setEditTracking(order.tracking_number ?? "");
    setEditMemo(order.admin_memo ?? "");
    setSaveError(null);
  };

  const handleSave = async () => {
    if (!editOrder || saving) return;
    setSaving(true);
    setSaveError(null);

    try {
      const res = await fetch(`/api/admin/rewards/orders/${editOrder.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: editStatus,
          tracking_number: editTracking || null,
          admin_memo: editMemo || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setSaveError(data.error || "업데이트에 실패했습니다.");
        return;
      }

      setEditOrder(null);
      fetchOrders(statusFilter);
    } catch {
      setSaveError("처리 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    });
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">리워드 주문 관리</h1>

      {/* 상태 필터 탭 */}
      <div className="flex gap-1 border-b border-neutral mb-6">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              statusFilter === tab.value
                ? "border-primary text-primary"
                : "border-transparent text-foreground-muted hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 주문 테이블 */}
      <div className="rounded-2xl border border-neutral bg-white overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-8 text-center text-foreground-muted text-sm">로딩 중...</div>
          ) : orders.length === 0 ? (
            <div className="p-8 text-center text-foreground-muted text-sm">주문이 없습니다</div>
          ) : (
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-surface border-b border-neutral">
                  <th className="px-4 py-3 font-semibold text-foreground whitespace-nowrap">접수일</th>
                  <th className="px-4 py-3 font-semibold text-foreground whitespace-nowrap">유저</th>
                  <th className="px-4 py-3 font-semibold text-foreground whitespace-nowrap">상품</th>
                  <th className="px-4 py-3 font-semibold text-foreground whitespace-nowrap text-right">포인트</th>
                  <th className="px-4 py-3 font-semibold text-foreground whitespace-nowrap">배송지</th>
                  <th className="px-4 py-3 font-semibold text-foreground whitespace-nowrap">상태</th>
                  <th className="px-4 py-3 font-semibold text-foreground whitespace-nowrap">송장번호</th>
                  <th className="px-4 py-3 font-semibold text-foreground whitespace-nowrap"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral">
                {orders.map((order) => {
                  const badge = STATUS_BADGE[order.status] ?? { label: order.status, color: "bg-neutral/20 text-foreground-muted" };
                  return (
                    <tr key={order.id} className="hover:bg-neutral/5">
                      <td className="px-4 py-3 text-foreground-muted whitespace-nowrap">
                        {new Date(order.created_at).toLocaleDateString("ko-KR")}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">{order.profiles?.nickname ?? "알 수 없음"}</p>
                        <p className="text-[10px] text-foreground-muted">{order.profiles?.email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-foreground">{order.rewards_store?.title ?? "-"}</p>
                        {order.rewards_store?.original_url && (
                          <a
                            href={order.rewards_store.original_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-primary hover:underline"
                          >
                            원본 링크
                          </a>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-foreground whitespace-nowrap">
                        {order.points_spent.toLocaleString()}P
                      </td>
                      <td className="px-4 py-3 max-w-[200px]">
                        <p className="text-xs text-foreground truncate">{order.recipient_name} / {order.recipient_phone}</p>
                        <p className="text-[10px] text-foreground-muted truncate">{order.recipient_address}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-bold ${badge.color}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs font-mono text-foreground">
                        {order.tracking_number || "-"}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => openEditModal(order)}
                          className="rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors whitespace-nowrap"
                        >
                          처리
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* 처리 모달 */}
      {editOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-foreground">주문 처리</h3>
            <p className="mt-1 text-sm text-foreground-muted">
              {editOrder.rewards_store?.title} - {editOrder.profiles?.nickname ?? "알 수 없음"}
            </p>

            {/* 배송지 정보 */}
            <div className="mt-4 rounded-xl bg-surface p-4 text-sm space-y-2 border border-neutral/50">
              <div className="flex justify-between items-center group">
                <p><span className="text-foreground-muted">수령인:</span> <span className="font-medium">{editOrder.recipient_name}</span></p>
                <button 
                  onClick={() => copyToClipboard(editOrder.recipient_name)}
                  className="text-[10px] text-primary hover:underline opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  복사
                </button>
              </div>
              <div className="flex justify-between items-center group">
                <p><span className="text-foreground-muted">연락처:</span> <span className="font-medium">{editOrder.recipient_phone}</span></p>
                <button 
                  onClick={() => copyToClipboard(editOrder.recipient_phone)}
                  className="text-[10px] text-primary hover:underline opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  복사
                </button>
              </div>
              <div className="flex justify-between items-start group">
                <p className="flex-1"><span className="text-foreground-muted">주소:</span> <span className="font-medium">{editOrder.recipient_address}</span></p>
                <button 
                  onClick={() => copyToClipboard(editOrder.recipient_address)}
                  className="text-[10px] text-primary hover:underline opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2"
                >
                  복사
                </button>
              </div>
              <p><span className="text-foreground-muted">동의 시각:</span> <span className="font-medium text-xs">{new Date(editOrder.consented_at).toLocaleString("ko-KR")}</span></p>
              
              {editOrder.rewards_store?.original_url && (
                <div className="pt-2 border-t border-dashed border-neutral mt-2">
                  <a 
                    href={editOrder.rewards_store.original_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="block w-full text-center py-2 bg-primary/5 text-primary text-xs font-bold rounded-lg border border-primary/20 hover:bg-primary/10"
                  >
                    Partner Mall 상품 확인하러 가기 ↗
                  </a>
                </div>
              )}
            </div>

            {copySuccess && (
              <div className="mt-2 text-center text-[10px] text-success-text font-medium">복사되었습니다!</div>
            )}

            {saveError && (
              <div className="mt-3 rounded-xl bg-red-500/10 p-3 text-sm font-medium text-red-500">
                {saveError}
              </div>
            )}

            <div className="mt-4 space-y-3">
              <div>
                <label className="form-label">상태 변경</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="form-input"
                >
                  <option value="pending">결제완료</option>
                  <option value="preparing">준비중</option>
                  <option value="shipped">배송중</option>
                  <option value="delivered">배송완료</option>
                  <option value="cancelled">취소</option>
                </select>
              </div>
              <div>
                <label className="form-label">송장번호</label>
                <input
                  type="text"
                  value={editTracking}
                  onChange={(e) => setEditTracking(e.target.value)}
                  placeholder="CJ1234567890"
                  className="form-input font-mono"
                />
              </div>
              <div>
                <label className="form-label">관리자 메모</label>
                <textarea
                  rows={3}
                  value={editMemo}
                  onChange={(e) => setEditMemo(e.target.value)}
                  placeholder="내부 메모 (유저에게 보이지 않음)"
                  className="form-input resize-none"
                />
              </div>
            </div>

            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setEditOrder(null)}
                className="flex-1 rounded-xl border border-neutral py-3 text-sm font-medium text-foreground hover:bg-neutral/10"
              >
                취소
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 rounded-xl bg-primary py-3 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-50"
              >
                {saving ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
