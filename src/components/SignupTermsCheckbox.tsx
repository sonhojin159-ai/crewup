"use client";

import { useState } from "react";
import { DISCLAIMERS } from "@/lib/disclaimers";

export default function SignupTermsCheckbox() {
  const [agreed, setAgreed] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  return (
    <div className="space-y-2">
      <label className="flex items-start gap-2 cursor-pointer">
        <input
          type="checkbox"
          name="termsAgreed"
          value="true"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          required
          className="mt-1 accent-primary"
        />
        <span className="text-sm text-foreground">
          <button
            type="button"
            onClick={() => setShowTerms(!showTerms)}
            className="font-semibold text-primary hover:underline"
          >
            이용약관
          </button>
          에 동의합니다. <span className="text-foreground-muted">(필수)</span>
        </span>
      </label>
      {showTerms && (
        <div className="rounded-xl border border-neutral bg-neutral/5 p-3 max-h-48 overflow-y-auto">
          <pre className="whitespace-pre-wrap text-xs leading-relaxed text-foreground-muted">
            {DISCLAIMERS.signup_terms}
          </pre>
        </div>
      )}
    </div>
  );
}
