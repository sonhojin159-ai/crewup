import Link from "next/link";
import Header from "@/components/Header";
import { login } from "@/app/auth/actions";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { OAuthButtons } from "@/components/auth/OAuthButtons";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  const error = params?.error;
  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="mx-auto max-w-sm px-4 py-12 sm:py-20">
        {/* Page heading */}
        <div className="mb-2 flex justify-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-secondary text-2xl text-white shadow-md shadow-primary/20">
            👋
          </span>
        </div>
        <h1 className="text-center text-2xl font-bold text-foreground">로그인</h1>
        <p className="mt-2 text-center text-sm text-foreground-muted">
          크루업에 돌아오신 걸 환영합니다
        </p>

        {error && (
          <div className="mt-4 rounded-xl bg-red-500/10 p-4 text-center text-sm text-red-500 font-medium">
            {error}
          </div>
        )}

        <form action={login} className="mt-8 space-y-5">
          <div>
            <label htmlFor="login-email" className="form-label">이메일</label>
            <input
              id="login-email"
              type="email"
              name="email"
              required
              placeholder="email@example.com"
              className="form-input"
              autoComplete="email"
            />
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label htmlFor="login-pw" className="form-label" style={{ margin: 0 }}>비밀번호</label>
              <Link href="/forgot-password" className="text-xs text-foreground-muted hover:text-primary">
                비밀번호 찾기
              </Link>
            </div>
            <input
              id="login-pw"
              type="password"
              name="password"
              required
              placeholder="비밀번호를 입력하세요"
              className="form-input"
              autoComplete="current-password"
            />
          </div>

          <SubmitButton pendingText="로그인 중..." className="btn-primary btn-primary-lg w-full">
            로그인
          </SubmitButton>
        </form>

        {/* Social login */}
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
          아직 계정이 없으신가요?{" "}
          <Link href="/signup" className="font-semibold text-primary hover:underline">
            회원가입
          </Link>
        </p>
      </div>
    </div>
  );
}
