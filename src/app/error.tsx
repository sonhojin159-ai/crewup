"use client";

import Link from "next/link";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 text-center">
      <p className="text-6xl">⚠️</p>
      <h1 className="mt-6 text-2xl font-bold text-foreground">오류가 발생했습니다</h1>
      <p className="mt-3 max-w-sm text-sm text-foreground-muted">
        일시적인 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.
        {error.digest && (
          <span className="block mt-1 text-xs text-foreground-muted/60">참조 코드: {error.digest}</span>
        )}
      </p>
      <div className="mt-8 flex gap-3">
        <button
          onClick={reset}
          className="btn-primary !px-6"
        >
          다시 시도
        </button>
        <Link href="/" className="btn-outline !px-6">
          홈으로 이동
        </Link>
      </div>
    </div>
  );
}
