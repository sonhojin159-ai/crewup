"use client";

import { useState, useEffect } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Link from "next/link";
import { logout } from "@/app/auth/actions";

export default function ProfilePage() {
  const [profile, setProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [nickname, setNickname] = useState("");
  const [roleType, setRoleType] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/profile")
      .then((res) => res.json())
      .then((data) => {
        setProfile(data);
        setNickname(data.nickname || "");
        setRoleType(data.role_type || "");
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  }, []);

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname, role_type: roleType }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "저장에 실패했습니다." });
      } else {
        setProfile((prev: any) => ({ ...prev, nickname, role_type: roleType }));
        setIsEditing(false);
        setMessage({ type: "success", text: "프로필이 성공적으로 업데이트되었습니다." });
      }
    } catch {
      setMessage({ type: "error", text: "저장 중 오류가 발생했습니다." });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="py-20 text-center text-foreground-muted">로딩 중...</div>
      </div>
    );
  }

  if (!profile || profile.error) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="mx-auto max-w-sm px-4 py-20 text-center">
          <p className="text-foreground-muted">로그인이 필요합니다.</p>
          <Link href="/login" className="mt-4 btn-primary inline-block">로그인하기</Link>
        </div>
      </div>
    );
  }

  const roleLabel = profile.role_type === "investor" ? "A형 · 투자자" : profile.role_type === "operator" ? "B형 · 실행자" : profile.role_type === "both" ? "투자자 + 실행자" : "미설정";

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="mx-auto max-w-2xl px-4 py-12">
        <h1 className="text-2xl font-bold text-foreground">내 프로필</h1>

        {message && (
          <div className={`mt-4 rounded-xl p-3 text-sm font-medium ${message.type === "success" ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-500"}`}>
            {message.text}
          </div>
        )}

        {/* Profile Card */}
        <div className="mt-6 rounded-2xl border border-neutral bg-surface p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-2xl font-bold text-primary">
              {profile.nickname?.[0]?.toUpperCase() || "?"}
            </div>
            <div>
              <p className="text-xl font-bold text-foreground">{profile.nickname || "닉네임 없음"}</p>
              <p className="text-sm text-foreground-muted">{profile.email}</p>
              <div className="mt-1 flex items-center gap-3">
                <span className="text-sm text-foreground-muted">{roleLabel}</span>
                {profile.reputation?.review_count > 0 && (
                  <div className="flex items-center gap-1 border-l border-neutral pl-3">
                    <span className="text-yellow-400">★</span>
                    <span className="text-sm font-bold text-foreground">{profile.reputation.avg_rating}</span>
                    <span className="text-[10px] text-foreground-muted">({profile.reputation.review_count})</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {isEditing ? (
            <div className="mt-6 space-y-4">
              <div>
                <label className="form-label">닉네임</label>
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  maxLength={20}
                  className="form-input"
                  placeholder="닉네임 (2~20자)"
                />
              </div>
              <div>
                <label className="form-label">관심 역할군</label>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {[
                    { value: "investor", label: "A형 · 투자자", desc: "자본 투자 중심" },
                    { value: "operator", label: "B형 · 실행자", desc: "시간·노하우 중심" },
                    { value: "both", label: "투자자 + 실행자", desc: "복합형" },
                  ].map((opt) => (
                    <label
                      key={opt.value}
                      className={`flex cursor-pointer items-start gap-2 rounded-xl border p-3 transition-colors ${roleType === opt.value ? "border-primary bg-primary/8" : "border-neutral hover:border-secondary"}`}
                    >
                      <input
                        type="radio"
                        name="role"
                        value={opt.value}
                        checked={roleType === opt.value}
                        onChange={() => setRoleType(opt.value)}
                        className="mt-0.5 accent-primary"
                      />
                      <div>
                        <p className="text-sm font-semibold text-foreground">{opt.label}</p>
                        <p className="text-xs text-foreground-muted">{opt.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={handleSave} disabled={isSaving} className="btn-primary flex-1 disabled:opacity-50">
                  {isSaving ? "저장 중..." : "저장하기"}
                </button>
                <button onClick={() => { setIsEditing(false); setNickname(profile.nickname); setRoleType(profile.role_type); }} className="btn-outline px-6">
                  취소
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setIsEditing(true)} className="mt-5 btn-outline w-full">
              프로필 수정
            </button>
          )}
        </div>

        {/* 계정 정보 */}
        <div className="mt-4 rounded-2xl border border-neutral bg-surface p-6 space-y-4">
          <h2 className="font-bold text-foreground">계정 정보</h2>
          <div className="flex justify-between text-sm">
            <span className="text-foreground-muted">이메일</span>
            <span className="font-medium text-foreground">{profile.email}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-foreground-muted">가입일</span>
            <span className="font-medium text-foreground">{new Date(profile.created_at).toLocaleDateString()}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-foreground-muted">비밀번호</span>
            <Link href="/forgot-password" className="text-primary text-xs hover:underline">비밀번호 변경</Link>
          </div>
        </div>

        {/* 관련 링크 */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Link href="/wallet" className="rounded-2xl border border-neutral bg-surface p-4 text-center hover:border-primary transition-colors">
            <p className="text-xl">💰</p>
            <p className="mt-1 text-sm font-semibold text-foreground">마이 월렛</p>
          </Link>
          <Link href="/crews" className="rounded-2xl border border-neutral bg-surface p-4 text-center hover:border-primary transition-colors">
            <p className="text-xl">🚀</p>
            <p className="mt-1 text-sm font-semibold text-foreground">내 크루</p>
          </Link>
        </div>

        {/* 로그아웃 */}
        <div className="mt-8">
          <form action={logout}>
            <button type="submit" className="w-full rounded-xl border border-neutral py-3 text-sm font-medium text-foreground-muted hover:bg-neutral/20 transition-colors">
              로그아웃
            </button>
          </form>
        </div>
      </div>
      <Footer />
    </div>
  );
}
