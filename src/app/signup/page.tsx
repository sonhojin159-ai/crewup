import Link from "next/link";
import Header from "@/components/Header";
import { signup } from "@/app/auth/actions";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { OAuthButtons } from "@/components/auth/OAuthButtons";
import SignupTermsCheckbox from "@/components/SignupTermsCheckbox";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const params = await searchParams;
  const error = params?.error;
  const message = params?.message;
  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="mx-auto max-w-sm px-4 py-12 sm:py-20">
        {/* Page heading */}
        <div className="mb-2 flex justify-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-secondary text-2xl text-white shadow-md shadow-primary/20">
            🚀
          </span>
        </div>
        <h1 className="text-center text-2xl font-bold text-foreground">회원가입</h1>
        <p className="mt-2 text-center text-sm text-foreground-muted">
          크루업과 함께 부업을 시작하세요
        </p>

        {error && (
          <div className="mt-4 rounded-xl bg-red-500/10 p-4 text-center text-sm text-red-500 font-medium">
            {error}
          </div>
        )}

        {message && (
          <div className="mt-4 rounded-xl bg-green-500/10 p-4 text-center text-sm text-green-500 font-medium">
            {message}
          </div>
        )}

        <form action={signup} className="mt-8 space-y-5">
          <div>
            <label htmlFor="signup-nick" className="form-label">닉네임</label>
            <input
              id="signup-nick"
              type="text"
              name="nickname"
              required
              placeholder="크루업에서 사용할 닉네임"
              className="form-input"
              autoComplete="nickname"
            />
          </div>
          <div>
            <label htmlFor="signup-email" className="form-label">이메일</label>
            <input
              id="signup-email"
              type="email"
              name="email"
              required
              placeholder="email@example.com"
              className="form-input"
              autoComplete="email"
            />
          </div>
          <div>
            <label htmlFor="signup-pw" className="form-label">비밀번호</label>
            <input
              id="signup-pw"
              type="password"
              name="password"
              required
              placeholder="8자 이상 입력하세요"
              className="form-input"
              autoComplete="new-password"
              minLength={8}
            />
          </div>
          <div>
            <label htmlFor="signup-pw2" className="form-label">비밀번호 확인</label>
            <input
              id="signup-pw2"
              type="password"
              name="passwordConfirm"
              required
              placeholder="비밀번호를 다시 입력하세요"
              className="form-input"
              autoComplete="new-password"
            />
          </div>

          {/* Role selection — CSS has-[:checked] pattern, no JS needed */}
          <div>
            <p className="form-label">관심 역할군</p>
            <div className="mt-2 grid grid-cols-2 gap-2" role="group" aria-label="역할군 선택">
              <label className="relative flex cursor-pointer items-start gap-2 rounded-xl border border-neutral p-3 transition-colors hover:border-secondary has-[:checked]:border-primary has-[:checked]:bg-primary/8">
                <input
                  type="radio"
                  name="role"
                  value="investor"
                  className="mt-0.5 accent-primary"
                />
                <div>
                  <p className="text-sm font-semibold text-foreground">A형 · 투자자</p>
                  <p className="text-xs text-foreground-muted">자본 투자 중심</p>
                </div>
              </label>
              <label className="relative flex cursor-pointer items-start gap-2 rounded-xl border border-neutral p-3 transition-colors hover:border-secondary has-[:checked]:border-primary has-[:checked]:bg-primary/8">
                <input
                  type="radio"
                  name="role"
                  value="operator"
                  className="mt-0.5 accent-primary"
                />
                <div>
                  <p className="text-sm font-semibold text-foreground">B형 · 실행자</p>
                  <p className="text-xs text-foreground-muted">시간·노하우 중심</p>
                </div>
              </label>
            </div>
          </div>

          <SignupTermsCheckbox />

          <SubmitButton pendingText="가입 중..." className="btn-primary btn-primary-lg w-full">
            가입하기
          </SubmitButton>
        </form>

        {/* Social signup */}
        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-neutral" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-background px-4 text-foreground-muted">또는</span>
            </div>
          </div>

          <OAuthButtons />
        </div>

        <p className="mt-8 text-center text-sm text-foreground-muted">
          이미 계정이 있으신가요?{" "}
          <Link href="/login" className="font-semibold text-primary hover:underline">
            로그인
          </Link>
        </p>
      </div>
    </div>
  );
}
