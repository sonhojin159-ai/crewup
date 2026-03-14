"use client";

import { useState } from "react";

const REPORT_TYPES = [
  { value: "revenue_hiding", label: "매출 은닉" },
  { value: "payment_default", label: "정산 미이행" },
  { value: "unauthorized_expense", label: "독단적 지출" },
  { value: "fraud", label: "사기" },
  { value: "harassment", label: "괴롭힘" },
  { value: "other", label: "기타" },
] as const;

interface ReportModalProps {
  targetUserId?: string;
  crewId?: string;
  onClose: () => void;
}

export default function ReportModal({ targetUserId, crewId, onClose }: ReportModalProps) {
  const [reportType, setReportType] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!reportType) {
      alert("신고 유형을 선택해주세요.");
      return;
    }
    if (!title.trim()) {
      alert("신고 제목을 입력해주세요.");
      return;
    }
    if (!description.trim()) {
      alert("신고 내용을 입력해주세요.");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUserId,
          crewId,
          reportType,
          title: title.trim(),
          description: description.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "신고 접수에 실패했습니다.");
      }

      alert("신고가 접수되었습니다. 검토 후 처리됩니다.");
      onClose();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "오류가 발생했습니다.";
      alert(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl max-h-[90vh] flex flex-col">
        <h3 className="text-lg font-bold text-foreground">신고하기</h3>
        <p className="mt-1 text-sm text-foreground-muted">
          부적절한 행위를 신고해주세요. 검토 후 조치됩니다.
        </p>

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4 flex-1 overflow-y-auto">
          <div>
            <label className="form-label">신고 유형</label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              className="form-input"
              required
            >
              <option value="">선택해주세요</option>
              {REPORT_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label">
              제목
              <span className="ml-1 text-xs text-foreground-muted">({title.length}/100)</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, 100))}
              className="form-input"
              placeholder="신고 제목을 입력해주세요"
              required
              maxLength={100}
            />
          </div>

          <div>
            <label className="form-label">
              상세 내용
              <span className="ml-1 text-xs text-foreground-muted">({description.length}/2000)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 2000))}
              className="form-input resize-none"
              rows={5}
              placeholder="신고 사유와 상황을 구체적으로 설명해주세요"
              required
              maxLength={2000}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-outline flex-1">
              취소
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "접수 중..." : "신고 접수"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
