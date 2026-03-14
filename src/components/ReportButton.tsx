"use client";

import { useState } from "react";
import ReportModal from "@/components/ReportModal";

interface ReportButtonProps {
  crewId: string;
  targetUserId: string;
}

export default function ReportButton({ crewId, targetUserId }: ReportButtonProps) {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="flex items-center gap-3 rounded-xl border border-neutral p-4 transition-colors hover:border-primary hover:shadow-sm w-full text-left"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-lg">
          {"⚠️"}
        </span>
        <div>
          <p className="font-semibold text-foreground">신고하기</p>
          <p className="text-xs text-foreground-muted">부적절한 활동 신고</p>
        </div>
      </button>

      {showModal && (
        <ReportModal
          crewId={crewId}
          targetUserId={targetUserId}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}
