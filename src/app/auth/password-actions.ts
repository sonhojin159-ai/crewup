"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function sendPasswordResetEmail(formData: FormData) {
  const email = formData.get("email") as string;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    redirect(`/forgot-password?error=${encodeURIComponent("유효한 이메일 주소를 입력해 주세요.")}`);
  }

  const supabase = await createClient();
  let origin: string | null = null;
  try {
    const hdrs = await headers();
    origin = hdrs.get("origin");
    if (!origin) {
      const host = hdrs.get("host");
      const protocol = hdrs.get("x-forwarded-proto") || "https";
      origin = host ? `${protocol}://${host}` : null;
    }
  } catch (e) {
    console.error("Error getting headers:", e);
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/reset-password`,
  });

  if (error) {
    console.error("Reset password error:", error);
    if (error.message.includes("rate limit") || error.message.includes("Rate limit")) {
      redirect(`/forgot-password?error=${encodeURIComponent("잠시 후 다시 시도해 주세요. (요청 횟수 초과)")}`);
    }
    redirect(`/forgot-password?error=${encodeURIComponent("이메일 발송 중 오류가 발생했습니다.")}`);
  }

  redirect(`/forgot-password?message=${encodeURIComponent("비밀번호 재설정 링크를 이메일로 발송했습니다. 메일함을 확인해 주세요.")}`);
}
