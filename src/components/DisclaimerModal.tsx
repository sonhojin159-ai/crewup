"use client";

import { useState } from "react";
import { DISCLAIMERS, ConsentType } from "@/lib/disclaimers";

interface DisclaimerModalProps {
  consentType: ConsentType;
  crewId?: string;
  title: string;
  onAgree: () => void;
  onCancel: () => void;
}

const CONSENT_TITLES: Record<ConsentType, string> = {
  signup_terms: "이용약관 동의",
  crew_create_disclaimer: "크루 생성 면책 동의",
  crew_join_disclaimer: "크루 참여 면책 동의",
  ledger_confirm: "장부 확정 면책 동의",
  settlement_disclaimer: "P2P 정산 면책 동의",
};

export default function DisclaimerModal({
  consentType,
  crewId,
  title,
  onAgree,
  onCancel,
}: DisclaimerModalProps) {
  const [checked, setChecked] = useState(false);
  const [isLogging, setIsLogging] = useState(false);

  const handleAgree = async () => {
    if (!checked || isLogging) return;
    setIsLogging(true);

    try {
      const res = await fetch("/api/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consentType, crewId }),
      });

      if (!res.ok) {
        alert("동의 기록 저장에 실패했습니다. 다시 시도해주세요.");
        return;
      }

      onAgree();
    } catch {
      alert("오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setIsLogging(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl max-h-[90vh] flex flex-col">
        <h3 className="text-lg font-bold text-foreground">
          {title || CONSENT_TITLES[consentType]}
        </h3>

        <div className="mt-4 flex-1 overflow-y-auto rounded-xl border border-neutral bg-neutral/5 p-4">
          <pre className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
            {DISCLAIMERS[consentType]}
          </pre>
        </div>

        <div className="mt-4 rounded-xl border border-primary/30 bg-primary/5 p-3">
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              className="mt-1 accent-primary"
            />
            <span className="text-sm font-medium text-foreground">
              위 내용을 충분히 읽고 이해하였으며, 이에 동의합니다.
              <span className="block text-xs text-foreground-muted mt-0.5">
                본 동의는 디지털 서명으로 기록되며, 동의 일시·IP가 저장됩니다.
              </span>
            </span>
          </label>
        </div>

        <div className="mt-4 flex gap-3">
          <button
            onClick={onCancel}
            className="btn-outline flex-1 !rounded-xl !py-3"
          >
            취소
          </button>
          <button
            onClick={handleAgree}
            disabled={!checked || isLogging}
            className="btn-primary flex-1 !rounded-xl !py-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLogging ? "처리 중..." : "동의하고 진행"}
          </button>
        </div>
      </div>
    </div>
  );
}
