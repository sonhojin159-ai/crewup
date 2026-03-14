import Header from "@/components/Header";
import Link from "next/link";
import { sendPasswordResetEmail } from "@/app/auth/password-actions";
import { SubmitButton } from "@/components/auth/SubmitButton";

export const metadata = {
  title: "비밀번호 찾기 | 크루업",
};

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const params = await searchParams;
  const error = params.error;
  const message = params.message;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="mx-auto max-w-sm px-4 py-12 sm:py-20">
        <div className="mb-2 flex justify-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-secondary text-2xl text-white shadow-md shadow-primary/20">
            🔑
          </span>
        </div>
        <h1 className="text-center text-2xl font-bold text-foreground">비밀번호 찾기</h1>
        <p className="mt-2 text-center text-sm text-foreground-muted">
          가입하신 이메일 주소를 입력하시면 재설정 링크를 보내드립니다
        </p>

        {error && (
          <div className="mt-4 rounded-xl bg-red-500/10 p-4 text-center text-sm text-red-500 font-medium">
            {error}
          </div>
        )}
        {message && (
          <div className="mt-4 rounded-xl bg-green-500/10 p-4 text-center text-sm text-green-600 font-medium">
            {message}
          </div>
        )}

        {!message && (
          <form action={sendPasswordResetEmail} className="mt-8 space-y-5">
            <div>
              <label htmlFor="reset-email" className="form-label">이메일</label>
              <input
                id="reset-email"
                type="email"
                name="email"
                required
                placeholder="가입 시 입력한 이메일"
                className="form-input"
                autoComplete="email"
              />
            </div>
            <SubmitButton pendingText="발송 중..." className="btn-primary btn-primary-lg w-full">
              재설정 링크 받기
            </SubmitButton>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-foreground-muted">
          <Link href="/login" className="font-semibold text-primary hover:underline">
            로그인으로 돌아가기
          </Link>
        </p>
      </div>
    </div>
  );
}
