"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { createClient } from "@/lib/supabase/client";
import { Crew } from "@/types/crew";

interface SubmissionFeed {
  id: string;
  content: string;
  status: string;
  created_at: string;
  profiles: { nickname: string; avatar_url: string | null };
  missions: { title: string };
}

export default function MissionsPage() {
  const params = useParams();
  const id = params.id as string;
  const [crew, setCrew] = useState<Crew | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [modalMission, setModalMission] = useState<{ id: string; title: string } | null>(null);
  const [submitContent, setSubmitContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feed, setFeed] = useState<SubmissionFeed[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [rewardLoading, setRewardLoading] = useState(false);
  const [rewardMessage, setRewardMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchCrewMissions = useCallback(async () => {
    setIsLoading(true);
    const supabase = createClient();

    // 현재 로그인 사용자 조회
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from("crews")
      .select(`
        *,
        missions (
          *,
          mission_verifications (id, user_id, distribution_status)
        )
      `)
      .eq("id", id)
      .single();

    if (error || !data) {
      console.error("Missions: Error fetching crew:", error);
    } else {
      setCrew({
        id: data.id,
        title: data.title,
        category: data.category,
        roleType: data.role_type,
        description: data.description,
        maxMembers: data.max_members,
        tags: data.tags || [],
        members: 0,
        entryPoints: data.entry_points || 0,
        deposit: data.deposit || 0,
        leaderFeeDeposit: data.leader_fee_deposit || 0,
        leaderMarginRate: data.leader_margin_rate || 0,
        missionRewardRate: data.mission_reward_rate || 0,
        missions: (data.missions || []).map((m: any) => ({
          ...m,
          // 현재 사용자의 인증 완료 여부로 판단 (개인별 기준)
          completed: user
            ? (m.mission_verifications || []).some(
                (v: { user_id: string; distribution_status: string }) =>
                  v.user_id === user.id && v.distribution_status === 'completed'
              )
            : false,
        })),
      });
    }
    setIsLoading(false);
  }, [id]);

  const fetchFeed = useCallback(async () => {
    setFeedLoading(true);
    try {
      const res = await fetch(`/api/crews/${id}/missions/feed`);
      if (res.ok) {
        const data = await res.json();
        setFeed(data);
      }
    } catch {
      console.error("Failed to fetch feed");
    }
    setFeedLoading(false);
  }, [id]);

  useEffect(() => {
    if (id) {
      fetchCrewMissions();
      fetchFeed();
    }
  }, [id, fetchCrewMissions, fetchFeed]);

  const handleSubmitVerification = async () => {
    if (!modalMission || !submitContent.trim() || isSubmitting) return;
    setIsSubmitting(true);

    try {
      const res = await fetch(`/api/crews/${id}/missions/${modalMission.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: submitContent.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "인증 제출에 실패했습니다.");
        return;
      }

      setModalMission(null);
      setSubmitContent("");
      alert("인증이 제출되었습니다! 크루장의 검토를 기다려주세요.");
      fetchFeed();
    } catch {
      alert("인증 제출 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // M5 Fix: 실제 API 호출로 리워드 신청
  const handleRewardClaim = async (missionId: string) => {
    if (rewardLoading) return;
    setRewardLoading(true);
    setRewardMessage(null);
    try {
      const res = await fetch(`/api/crews/${id}/missions/${missionId}/reward`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setRewardMessage({ type: "error", text: data.error || "리워드 신청에 실패했습니다." });
      } else {
        setRewardMessage({ type: "success", text: data.message || "리워드가 지급되었습니다!" });
        fetchCrewMissions();
      }
    } catch {
      setRewardMessage({ type: "error", text: "리워드 신청 중 오류가 발생했습니다." });
    } finally {
      setRewardLoading(false);
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

  if (!crew || !crew.missions) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="py-20 text-center text-foreground-muted">크루를 찾을 수 없습니다</div>
      </div>
    );
  }

  const missions = crew.missions;
  const total = missions.length;
  const done = missions.filter((m) => m.completed).length;
  const rate = total > 0 ? Math.round((done / total) * 100) : 0;
  const rewardAvailable = rate >= 80;

  const formatRelativeTime = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes}분 전`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}시간 전`;
    const days = Math.floor(hours / 24);
    return `${days}일 전`;
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="mx-auto max-w-3xl px-4 py-8">
        {/* Breadcrumb */}
        <nav className="mb-6 text-sm text-foreground-muted">
          <Link href="/crews" className="hover:text-primary">크루 찾기</Link>
          <span className="mx-2">/</span>
          <Link href={`/crews/${crew.id}`} className="hover:text-primary">{crew.title}</Link>
          <span className="mx-2">/</span>
          <span className="text-foreground">미션</span>
        </nav>

        {/* Progress Ring */}
        <div className="flex flex-col items-center rounded-2xl border border-neutral bg-white p-8">
          <div className="relative flex h-36 w-36 items-center justify-center">
            <svg className="h-36 w-36 -rotate-90" viewBox="0 0 144 144">
              <circle cx="72" cy="72" r="62" fill="none" stroke="currentColor" strokeWidth="10" className="text-neutral/50" />
              <circle
                cx="72" cy="72" r="62" fill="none"
                stroke="currentColor" strokeWidth="10" strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 62}`}
                strokeDashoffset={`${2 * Math.PI * 62 * (1 - rate / 100)}`}
                className={rate >= 80 ? "text-success-text" : "text-primary"}
              />
            </svg>
            <div className="absolute text-center">
              <p className="text-3xl font-bold text-foreground">{rate}%</p>
              <p className="text-xs text-foreground-muted">{done}/{total} 완료</p>
            </div>
          </div>
          <p className="mt-4 text-sm text-foreground-muted">
            {rewardAvailable ? "리워드 신청이 가능합니다!" : "80% 이상 달성 시 리워드 신청 가능"}
          </p>

          {/* Reward Message */}
          {rewardMessage && (
            <div className={`mt-3 rounded-xl px-4 py-2.5 text-sm font-medium ${rewardMessage.type === "success" ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-500"}`}>
              {rewardMessage.text}
            </div>
          )}

          <button
            disabled={!rewardAvailable || rewardLoading}
            onClick={rewardAvailable ? () => handleRewardClaim(missions.find((m) => !m.completed)?.id || missions[0]?.id) : undefined}
            className={`mt-4 rounded-xl px-8 py-3 text-sm font-semibold transition-colors ${
              rewardAvailable && !rewardLoading
                ? "bg-success-text text-white hover:opacity-90"
                : "bg-neutral/30 text-foreground-muted cursor-not-allowed"
            }`}
          >
            {rewardLoading ? "처리 중..." : "리워드 신청"}
          </button>
        </div>

        {/* Mission Cards */}
        <div className="mt-8">
          <h3 className="text-xl font-bold text-foreground">미션 목록</h3>
          <div className="mt-4 space-y-3">
            {crew.missions.map((mission, idx) => (
              <div
                key={mission.id}
                className={`rounded-xl border p-5 ${
                  mission.completed ? "border-success bg-success/20" : "border-neutral"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                        mission.completed
                          ? "bg-success-text text-white"
                          : "bg-surface text-foreground-muted border border-neutral"
                      }`}
                    >
                      {mission.completed ? "✓" : idx + 1}
                    </div>
                    <div>
                      <p className={`font-semibold ${mission.completed ? "text-success-text" : "text-foreground"}`}>
                        {mission.title}
                      </p>
                      <p className="mt-1 text-sm text-foreground-muted">{mission.description}</p>
                      {mission.completed && (
                        <button
                          onClick={() => handleRewardClaim(mission.id)}
                          disabled={rewardLoading}
                          className="mt-2 rounded-lg px-3 py-1 text-xs font-semibold bg-success-text/10 text-success-text hover:bg-success-text/20 transition-colors disabled:opacity-50"
                        >
                          🎁 리워드 신청
                        </button>
                      )}
                    </div>
                  </div>
                  {!mission.completed && (
                    <button
                      onClick={() => setModalMission({ id: mission.id, title: mission.title })}
                      className="btn-primary !py-2 !px-4 !text-xs !rounded-lg"
                    >
                      인증하기
                    </button>
                  )}
                  {mission.completed && (
                    <span className="badge-success">완료</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Verification Feed */}
        <div className="mt-8">
          <h3 className="text-xl font-bold text-foreground">크루원 인증 피드</h3>
          <p className="mt-1 text-sm text-foreground-muted">크루원들의 미션 인증 현황입니다</p>
          <div className="mt-4 space-y-3">
            {feedLoading ? (
              <div className="py-8 text-center text-sm text-foreground-muted">로딩 중...</div>
            ) : feed.length === 0 ? (
              <div className="rounded-xl border border-neutral bg-surface p-8 text-center">
                <p className="text-sm text-foreground-muted">아직 인증 내역이 없습니다</p>
                <p className="mt-1 text-xs text-foreground-muted">미션을 수행하고 인증해보세요!</p>
              </div>
            ) : (
              feed.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-xl border border-neutral p-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface text-sm border border-neutral">
                      {item.profiles?.avatar_url ? (
                        <img src={item.profiles.avatar_url} alt="" className="h-full w-full rounded-full object-cover" />
                      ) : "👤"}
                    </div>
                    <div>
                      <p className="text-sm">
                        <span className="font-semibold text-foreground">{item.profiles?.nickname || "알 수 없음"}</span>
                        <span className="text-foreground-muted">님이 </span>
                        <span className="font-medium text-primary">{item.missions?.title || "미션"}</span>
                        <span className="text-foreground-muted"> 인증</span>
                      </p>
                      <div className="mt-0.5 flex items-center gap-2">
                        <p className="text-xs text-foreground-muted">{formatRelativeTime(item.created_at)}</p>
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          item.status === "approved" ? "bg-success/20 text-success-text" :
                          item.status === "rejected" ? "bg-primary/10 text-primary" :
                          "bg-amber-100 text-amber-800"
                        }`}>
                          {item.status === "approved" ? "승인됨" : item.status === "rejected" ? "반려됨" : "검토중"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Verification Modal */}
      {modalMission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-bold text-foreground">미션 인증</h4>
              <button
                onClick={() => { setModalMission(null); setSubmitContent(""); }}
                className="text-foreground-muted hover:text-foreground"
              >
                ✕
              </button>
            </div>
            <p className="mt-2 text-sm text-foreground-muted">
              <span className="font-medium text-foreground">{modalMission.title}</span> 미션을 인증합니다
            </p>

            <div className="mt-4">
              <label className="form-label">인증 내용</label>
              <textarea
                rows={3}
                placeholder="미션 수행 내용을 작성해주세요 (최대 1000자)"
                className="form-input resize-none"
                value={submitContent}
                onChange={(e) => setSubmitContent(e.target.value)}
                maxLength={1000}
              />
              <p className="mt-1 text-right text-xs text-foreground-muted">{submitContent.length}/1000</p>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={handleSubmitVerification}
                disabled={isSubmitting || !submitContent.trim()}
                className="btn-primary btn-primary-lg flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "제출 중..." : "인증 제출"}
              </button>
              <button
                onClick={() => { setModalMission(null); setSubmitContent(""); }}
                className="btn-outline py-3 px-6"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
