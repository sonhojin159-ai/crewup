'use client';

import { useState } from 'react';

interface SuggestionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SuggestionModal({ isOpen, onClose }: SuggestionModalProps) {
  const [productName, setProductName] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productName.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/rewards/suggestions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          product_name: productName.trim(),
          reason: reason.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '제안 등록에 실패했습니다.');
      }

      setSuccess(true);
      setTimeout(() => {
        onClose();
        setSuccess(false);
        setProductName('');
        setReason('');
      }, 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-3xl bg-surface shadow-2xl animate-in fade-in zoom-in duration-200">
        <div className="px-6 py-6 sm:px-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-foreground">리워드 상품 제안하기</h2>
            <button
              onClick={onClose}
              className="p-2 transition-colors rounded-full hover:bg-neutral/10"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {success ? (
            <div className="py-12 text-center animate-in fade-in slide-in-from-bottom-4">
              <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10">
                <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-lg font-medium text-foreground">제안이 완료되었습니다!</p>
              <p className="text-sm text-foreground-muted mt-2">관리자가 확인 후 검토하겠습니다.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10">
                <p className="text-sm text-primary font-medium flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  파트너사 상품 안내
                </p>
                <p className="mt-1 text-xs text-foreground-muted leading-relaxed">
                  <a 
                    href="https://mk-me.kr/sonhojin159" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="underline text-primary hover:text-primary-dark"
                  >
                    M-Pick (신화캐슬 파트너 몰)
                  </a>
                  에서 원하는 상품의 **제품명**을 아래에 입력해 주세요.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground-muted mb-1.5 ml-1">상품명</label>
                <input
                  type="text"
                  required
                  placeholder="예: 페로핀 투웨이 후드"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  className="w-full rounded-2xl border border-neutral bg-neutral/5 px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground-muted mb-1.5 ml-1">제안 이유 (내용)</label>
                <textarea
                  rows={3}
                  placeholder="이 상품이 필요한 이유나 특징을 적어주세요."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full resize-none rounded-2xl border border-neutral bg-neutral/5 px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                />
              </div>

              {error && (
                <p className="text-sm text-red-500 bg-red-50 p-3 rounded-xl">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-2xl bg-primary py-4 text-sm font-bold text-white transition-all hover:bg-primary-dark disabled:opacity-50 active:scale-[0.98]"
              >
                {loading ? '등록 중...' : '제안 등록하기'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
