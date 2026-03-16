"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";

interface Product {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  point_price: number;
  original_url: string | null;
  is_available: boolean;
  created_at: string;
  updated_at: string;
}

interface ProductForm {
  title: string;
  description: string;
  point_price: string;
  original_url: string;
  image_url: string;
  is_available: boolean;
}

const EMPTY_FORM: ProductForm = {
  title: "",
  description: "",
  point_price: "",
  original_url: "",
  image_url: "",
  is_available: true,
};

export default function AdminRewardsProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // 모달
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProductForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 이미지 업로드
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/rewards/products");
      if (res.ok) setProducts(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const openCreateModal = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError(null);
    setModalOpen(true);
  };

  const openEditModal = (product: Product) => {
    setEditingId(product.id);
    setForm({
      title: product.title,
      description: product.description ?? "",
      point_price: String(product.point_price),
      original_url: product.original_url ?? "",
      image_url: product.image_url ?? "",
      is_available: product.is_available,
    });
    setError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
  };

  const uploadImage = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/admin/rewards/products/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "이미지 업로드에 실패했습니다.");
        return;
      }
      setForm((prev) => ({ ...prev, image_url: data.url }));
    } catch {
      setError("이미지 업로드 중 오류가 발생했습니다.");
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadImage(file);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadImage(file);
  };

  const handleSave = async () => {
    if (saving) return;
    setError(null);

    const pointPrice = parseInt(form.point_price, 10);
    if (!form.title.trim()) {
      setError("상품명을 입력해주세요.");
      return;
    }
    if (!form.point_price || isNaN(pointPrice) || pointPrice <= 0 || !Number.isInteger(pointPrice)) {
      setError("포인트가는 양수 정수로 입력해주세요.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        point_price: pointPrice,
        original_url: form.original_url.trim() || null,
        image_url: form.image_url.trim() || null,
        is_available: form.is_available,
      };

      const url = editingId
        ? `/api/admin/rewards/products/${editingId}`
        : "/api/admin/rewards/products";

      const res = await fetch(url, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "저장에 실패했습니다.");
        return;
      }

      closeModal();
      fetchProducts();
    } catch {
      setError("처리 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (product: Product) => {
    if (!confirm(`"${product.title}" 상품을 삭제하시겠습니까?`)) return;

    try {
      const res = await fetch(`/api/admin/rewards/products/${product.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "삭제에 실패했습니다.");
        return;
      }
      fetchProducts();
    } catch {
      alert("삭제 중 오류가 발생했습니다.");
    }
  };

  const toggleAvailability = async (product: Product) => {
    try {
      const res = await fetch(`/api/admin/rewards/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_available: !product.is_available }),
      });
      if (res.ok) {
        setProducts((prev) =>
          prev.map((p) =>
            p.id === product.id ? { ...p, is_available: !p.is_available } : p
          )
        );
      }
    } catch {
      // silent fail for toggle
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">리워드 상품 관리</h1>
        <button
          onClick={openCreateModal}
          className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-hover transition-colors"
        >
          + 상품 추가
        </button>
      </div>

      {/* 상품 테이블 */}
      <div className="rounded-2xl border border-neutral bg-white overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-8 text-center text-foreground-muted text-sm">
              로딩 중...
            </div>
          ) : products.length === 0 ? (
            <div className="p-8 text-center text-foreground-muted text-sm">
              등록된 상품이 없습니다
            </div>
          ) : (
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-surface border-b border-neutral">
                  <th className="px-4 py-3 font-semibold text-foreground whitespace-nowrap">
                    이미지
                  </th>
                  <th className="px-4 py-3 font-semibold text-foreground whitespace-nowrap">
                    상품명
                  </th>
                  <th className="px-4 py-3 font-semibold text-foreground whitespace-nowrap text-right">
                    포인트가
                  </th>
                  <th className="px-4 py-3 font-semibold text-foreground whitespace-nowrap text-center">
                    판매상태
                  </th>
                  <th className="px-4 py-3 font-semibold text-foreground whitespace-nowrap">
                    등록일
                  </th>
                  <th className="px-4 py-3 font-semibold text-foreground whitespace-nowrap" />
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral">
                {products.map((product) => (
                  <tr key={product.id} className="hover:bg-neutral/5">
                    <td className="px-4 py-3">
                      {product.image_url ? (
                        <Image
                          src={product.image_url}
                          alt={product.title}
                          width={48}
                          height={48}
                          className="rounded-lg object-cover"
                          unoptimized
                        />
                      ) : (
                        <div className="h-12 w-12 rounded-lg bg-neutral/20 flex items-center justify-center text-foreground-muted text-xs">
                          N/A
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">
                        {product.title}
                      </p>
                      {product.description && (
                        <p className="text-xs text-foreground-muted mt-0.5 line-clamp-1">
                          {product.description}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-foreground whitespace-nowrap">
                      {product.point_price.toLocaleString()}P
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => toggleAvailability(product)}
                        className={`inline-block rounded-full px-2.5 py-1 text-xs font-bold transition-colors cursor-pointer ${
                          product.is_available
                            ? "bg-green-100 text-green-700 hover:bg-green-200"
                            : "bg-red-100 text-red-600 hover:bg-red-200"
                        }`}
                      >
                        {product.is_available ? "판매중" : "품절"}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-foreground-muted whitespace-nowrap">
                      {new Date(product.created_at).toLocaleDateString("ko-KR")}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => openEditModal(product)}
                          className="rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors"
                        >
                          수정
                        </button>
                        <button
                          onClick={() => handleDelete(product)}
                          className="rounded-lg bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-500 hover:bg-red-500/20 transition-colors"
                        >
                          삭제
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* 추가/수정 모달 */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-foreground">
              {editingId ? "상품 수정" : "상품 추가"}
            </h3>

            {error && (
              <div className="mt-3 rounded-xl bg-red-500/10 p-3 text-sm font-medium text-red-500">
                {error}
              </div>
            )}

            <div className="mt-4 space-y-4">
              {/* 이미지 업로드 */}
              <div>
                <label className="form-label">상품 이미지</label>
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-4 cursor-pointer transition-colors ${
                    dragOver
                      ? "border-primary bg-primary/5"
                      : "border-neutral hover:border-primary/50"
                  }`}
                >
                  {form.image_url ? (
                    <div className="relative">
                      <Image
                        src={form.image_url}
                        alt="미리보기"
                        width={120}
                        height={120}
                        className="rounded-lg object-cover"
                        unoptimized
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setForm((prev) => ({ ...prev, image_url: "" }));
                        }}
                        className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-red-500 text-white text-xs flex items-center justify-center hover:bg-red-600"
                      >
                        X
                      </button>
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      {uploading ? (
                        <p className="text-sm text-foreground-muted">
                          업로드 중...
                        </p>
                      ) : (
                        <>
                          <p className="text-sm font-medium text-foreground-muted">
                            클릭하거나 이미지를 드래그해주세요
                          </p>
                          <p className="text-xs text-foreground-muted mt-1">
                            JPG, PNG, GIF, WebP (최대 5MB)
                          </p>
                        </>
                      )}
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </div>
              </div>

              {/* 상품명 */}
              <div>
                <label className="form-label">
                  상품명 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, title: e.target.value }))
                  }
                  placeholder="상품명을 입력하세요"
                  className="form-input"
                />
              </div>

              {/* 설명 */}
              <div>
                <label className="form-label">설명</label>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  placeholder="상품 설명 (선택)"
                  className="form-input resize-none"
                />
              </div>

              {/* 포인트가 */}
              <div>
                <label className="form-label">
                  포인트가 <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={form.point_price}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      point_price: e.target.value,
                    }))
                  }
                  placeholder="예: 5000"
                  min="1"
                  step="1"
                  className="form-input"
                />
              </div>

              {/* 원본 URL */}
              <div>
                <label className="form-label">Partner Mall(신화캐슬) URL</label>
                <input
                  type="url"
                  value={form.original_url}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      original_url: e.target.value,
                    }))
                  }
                  placeholder="위탁 결제를 진행할 원본 상품 링크"
                  className="form-input"
                />
              </div>

              {/* 판매 여부 토글 */}
              <div className="flex items-center justify-between">
                <label className="form-label mb-0">판매 여부</label>
                <button
                  type="button"
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      is_available: !prev.is_available,
                    }))
                  }
                  className={`relative h-7 w-12 rounded-full transition-colors ${
                    form.is_available ? "bg-primary" : "bg-neutral/40"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                      form.is_available ? "translate-x-5" : "translate-x-0.5"
                    }`}
                  />
                </button>
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
                onClick={handleSave}
                disabled={saving || uploading}
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
