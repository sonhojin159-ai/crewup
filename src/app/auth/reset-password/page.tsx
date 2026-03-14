"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("비밀번호는 8자 이상이어야 합니다.");
      return;
    }
    if (password !== confirm) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }

    setIsSubmitting(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setError("비밀번호 변경에 실패했습니다. 링크가 만료되었을 수 있습니다.");
      setIsSubmitting(false);
      return;
    }

    setSuccess(true);
    setTimeout(() => router.push("/login"), 3000);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="mx-auto max-w-sm px-4 py-12 sm:py-20">
        <div className="mb-2 flex justify-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-secondary text-2xl text-white shadow-md shadow-primary/20">
            🔐
          </span>
        </div>
        <h1 className="text-center text-2xl font-bold text-foreground">새 비밀번호 설정</h1>
        <p className="mt-2 text-center text-sm text-foreground-muted">
          새로운 비밀번호를 입력해 주세요
        </p>

        {success ? (
          <div className="mt-8 rounded-xl bg-green-500/10 p-6 text-center">
            <p className="text-2xl">✅</p>
            <p className="mt-2 font-semibold text-green-600">비밀번호가 변경되었습니다!</p>
            <p className="mt-1 text-sm text-foreground-muted">잠시 후 로그인 페이지로 이동합니다...</p>
          </div>
        ) : (
          <form onSubmit={handleReset} className="mt-8 space-y-5">
            {error && (
              <div className="rounded-xl bg-red-500/10 p-4 text-center text-sm text-red-500 font-medium">
                {error}
              </div>
            )}
            <div>
              <label htmlFor="new-pw" className="form-label">새 비밀번호</label>
              <input
                id="new-pw"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="8자 이상"
                className="form-input"
                autoComplete="new-password"
              />
            </div>
            <div>
              <label htmlFor="confirm-pw" className="form-label">비밀번호 확인</label>
              <input
                id="confirm-pw"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                placeholder="비밀번호를 다시 입력하세요"
                className="form-input"
                autoComplete="new-password"
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary btn-primary-lg w-full disabled:opacity-50"
            >
              {isSubmitting ? "변경 중..." : "비밀번호 변경"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
