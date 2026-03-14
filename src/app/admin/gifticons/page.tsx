"use client";

import { useState, useEffect, useCallback } from "react";

interface Product {
  id: string;
  name: string;
  brand: string;
  emoji: string;
  denomination: number;
  points_required: number;
  is_active: boolean;
  stock?: number;
}

export default function AdminGifticonsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [codesInput, setCodesInput] = useState("");
  const [uploadMsg, setUploadMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: "", brand: "", emoji: "🎁", denomination: "", points_required: "" });
  const [addMsg, setAddMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  // 교환 내역 상태
  const [exchanges, setExchanges] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/gifticons");
      if (res.ok) {
        const data = await res.json();
        setProducts(data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchExchanges = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch("/api/admin/gifticons/exchanges");
      if (res.ok) {
        const data = await res.json();
        setExchanges(data);
      }
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => { 
    fetchProducts();
    fetchExchanges();
  }, [fetchProducts, fetchExchanges]);

  const handleUploadCodes = async () => {
    if (!selectedProduct || !codesInput.trim() || isUploading) return;
    setIsUploading(true);
    setUploadMsg(null);
    try {
      const res = await fetch(`/api/gifticons/${selectedProduct.id}/codes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codes: codesInput }),
      });
      const data = await res.json();
      if (!res.ok) {
        setUploadMsg({ type: "error", text: data.error });
      } else {
        setUploadMsg({ type: "success", text: `${data.uploaded}개 코드가 등록되었습니다.` });
        setCodesInput("");
        fetchProducts();
      }
    } catch {
      setUploadMsg({ type: "error", text: "업로드 중 오류가 발생했습니다." });
    } finally {
      setIsUploading(false);
    }
  };

  const handleAddProduct = async () => {
    if (isAdding) return;
    setIsAdding(true);
    setAddMsg(null);
    try {
      const res = await fetch("/api/gifticons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newProduct,
          denomination: parseInt(newProduct.denomination),
          points_required: parseInt(newProduct.points_required),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAddMsg({ type: "error", text: data.error });
      } else {
        setAddMsg({ type: "success", text: "상품이 추가되었습니다." });
        setNewProduct({ name: "", brand: "", emoji: "🎁", denomination: "", points_required: "" });
        setShowAddForm(false);
        fetchProducts();
      }
    } catch {
      setAddMsg({ type: "error", text: "추가 중 오류가 발생했습니다." });
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">기프티콘 관리</h1>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="btn-primary !py-2 !px-4 !text-sm"
        >
          + 상품 추가
        </button>
      </div>

      {/* 새 상품 추가 폼 */}
      {showAddForm && (
        <div className="mb-6 rounded-2xl border border-neutral bg-surface p-5">
          <h2 className="font-bold text-foreground mb-4">새 상품 추가</h2>
          {addMsg && (
            <div className={`mb-3 rounded-xl p-3 text-sm ${addMsg.type === "success" ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-500"}`}>
              {addMsg.text}
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="form-label">이모지</label>
              <input value={newProduct.emoji} onChange={e => setNewProduct(p => ({ ...p, emoji: e.target.value }))} className="form-input" placeholder="🎁" />
            </div>
            <div>
              <label className="form-label">브랜드명</label>
              <input value={newProduct.brand} onChange={e => setNewProduct(p => ({ ...p, brand: e.target.value }))} className="form-input" placeholder="배달의민족" />
            </div>
            <div className="sm:col-span-2">
              <label className="form-label">상품명</label>
              <input value={newProduct.name} onChange={e => setNewProduct(p => ({ ...p, name: e.target.value }))} className="form-input" placeholder="배달의민족 금액권 1만원" />
            </div>
            <div>
              <label className="form-label">금액 (원)</label>
              <input type="number" value={newProduct.denomination} onChange={e => setNewProduct(p => ({ ...p, denomination: e.target.value }))} className="form-input" placeholder="10000" />
            </div>
            <div>
              <label className="form-label">필요 포인트</label>
              <input type="number" value={newProduct.points_required} onChange={e => setNewProduct(p => ({ ...p, points_required: e.target.value }))} className="form-input" placeholder="10000" />
            </div>
          </div>
          <button onClick={handleAddProduct} disabled={isAdding} className="mt-4 btn-primary disabled:opacity-50">
            {isAdding ? "추가 중..." : "추가하기"}
          </button>
        </div>
      )}

      {/* 상품 목록 + 코드 업로드 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* 왼쪽: 상품 목록 */}
        <div className="rounded-2xl border border-neutral bg-white overflow-hidden">
          <div className="px-5 py-4 border-b border-neutral bg-surface">
            <h2 className="font-bold text-foreground">상품 목록</h2>
            <p className="text-xs text-foreground-muted mt-0.5">상품을 클릭하면 코드를 업로드할 수 있습니다</p>
          </div>
          {loading ? (
            <div className="p-8 text-center text-foreground-muted text-sm">로딩 중...</div>
          ) : (
            <div className="divide-y divide-neutral">
              {products.map((product) => (
                <button
                  key={product.id}
                  onClick={() => { setSelectedProduct(product); setUploadMsg(null); setCodesInput(""); }}
                  className={`w-full flex items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-primary/5 ${selectedProduct?.id === product.id ? "bg-primary/10 border-l-4 border-primary" : ""}`}
                >
                  <span className="text-2xl w-8 text-center">{product.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground text-sm truncate">{product.name}</p>
                    <p className="text-xs text-foreground-muted">{product.points_required.toLocaleString()}P 교환</p>
                  </div>
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${(product.stock ?? 0) > 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                    재고 {product.stock ?? 0}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 오른쪽: 코드 업로드 패널 */}
        <div className="rounded-2xl border border-neutral bg-white overflow-hidden">
          <div className="px-5 py-4 border-b border-neutral bg-surface">
            <h2 className="font-bold text-foreground">코드 업로드</h2>
            <p className="text-xs text-foreground-muted mt-0.5">
              {selectedProduct ? `${selectedProduct.name} — 코드를 한 줄에 하나씩 입력` : "왼쪽에서 상품을 선택하세요"}
            </p>
          </div>

          {!selectedProduct ? (
            <div className="flex items-center justify-center h-48 text-sm text-foreground-muted">
              ← 먼저 상품을 선택해주세요
            </div>
          ) : (
            <div className="p-5">
              {uploadMsg && (
                <div className={`mb-4 rounded-xl p-3 text-sm ${uploadMsg.type === "success" ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-500"}`}>
                  {uploadMsg.text}
                </div>
              )}
              <label className="form-label">코드 목록 (한 줄에 하나)</label>
              <textarea
                rows={10}
                value={codesInput}
                onChange={e => setCodesInput(e.target.value)}
                placeholder={`BAEMIN-XXXX-XXXX-XXXX\nBAEMIN-YYYY-YYYY-YYYY\n...`}
                className="form-input font-mono text-sm resize-none"
              />
              <div className="flex items-center justify-between mt-2">
                <p className="text-xs text-foreground-muted">
                  {codesInput.split("\n").filter(c => c.trim()).length}개 코드 입력됨
                </p>
                <button
                  onClick={handleUploadCodes}
                  disabled={isUploading || !codesInput.trim()}
                  className="btn-primary !py-2 !px-5 !text-sm disabled:opacity-50"
                >
                  {isUploading ? "업로드 중..." : "코드 등록"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 교환 내역 섹션 */}
      <div className="mt-8 rounded-2xl border border-neutral bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral bg-surface">
          <h2 className="font-bold text-foreground">전체 교환 내역</h2>
          <p className="text-xs text-foreground-muted mt-0.5">유저의 포인트 교환 기록을 확인합니다</p>
        </div>
        <div className="overflow-x-auto">
          {historyLoading ? (
            <div className="p-8 text-center text-foreground-muted text-sm">로딩 중...</div>
          ) : exchanges.length === 0 ? (
            <div className="p-8 text-center text-foreground-muted text-sm">교환 내역이 없습니다</div>
          ) : (
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-surface border-b border-neutral">
                  <th className="px-5 py-3 font-semibold text-foreground">날짜</th>
                  <th className="px-5 py-3 font-semibold text-foreground">유저</th>
                  <th className="px-5 py-3 font-semibold text-foreground">상품</th>
                  <th className="px-5 py-3 font-semibold text-foreground">발급 코드</th>
                  <th className="px-5 py-3 font-semibold text-foreground text-right">사용한 포인트</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral">
                {exchanges.map((ex) => (
                  <tr key={ex.id} className="hover:bg-neutral/5">
                    <td className="px-5 py-3 text-foreground-muted whitespace-nowrap">
                      {new Date(ex.created_at).toLocaleString()}
                    </td>
                    <td className="px-5 py-3">
                      <p className="font-medium text-foreground">{ex.profiles?.full_name || "익명"}</p>
                      <p className="text-[10px] text-foreground-muted">{ex.profiles?.email}</p>
                    </td>
                    <td className="px-5 py-3">
                      <p className="text-foreground">{ex.gifticon_products?.name}</p>
                      <p className="text-[10px] text-foreground-muted">{ex.gifticon_products?.brand}</p>
                    </td>
                    <td className="px-5 py-3">
                      <code className="text-xs bg-surface px-2 py-1 rounded border border-neutral font-mono text-primary">
                        {ex.code_revealed}
                      </code>
                    </td>
                    <td className="px-5 py-3 text-right font-medium text-foreground">
                      {ex.points_spent.toLocaleString()}P
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
