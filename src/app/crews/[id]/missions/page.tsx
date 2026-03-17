"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { useParams } from "next/navigation";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { createClient } from "@/lib/supabase/client";
import { Crew } from "@/types/crew";

interface SubmissionFeed {
  id: string;
  mission_id: string;
  content: string;
  status: string;
  created_at: string;
  submitted_by: string;
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
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchCrewMissions = useCallback(async () => {
    setIsLoading(true);
    const supabase = createClient();

    // 현재 로그인 사용자 조회
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setCurrentUserId(user.id);

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
        status: data.status || 'active',
        createdBy: data.created_by,
        missions: (data.missions || []).map((m: any) => ({
          ...m,
          // 현재 사용자의 인증 완료 여부로 판단 (개인별 기준)
          completed: user
            ? (Array.isArray(m.mission_verifications) ? m.mission_verifications : []).some(
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


  const handleVerifySubmission = async (submission: SubmissionFeed, action: "approve" | "reject") => {
    if (actionLoading) return;
    
    let reason = "";
    if (action === "reject") {
      reason = prompt("반려 사유를 입력해주세요 (선택사항)") || "";
    } else if (!confirm("이 인증을 승인하시겠습니까? 리워드가 즉시 배분됩니다.")) {
      return;
    }

    setActionLoading(submission.id);
    try {
      const endpoint = action === "approve" ? "verify" : "reject";
      const payload = action === "approve" 
        ? { submissionId: submission.id }
        : { submissionId: submission.id, reason };

      const res = await fetch(`/api/crews/${id}/missions/${submission.mission_id}/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "처리에 실패했습니다.");
      } else {
        alert(action === "approve" ? "인증이 성공적으로 승인되었습니다." : "인증이 반려되었습니다.");
        fetchFeed();
        fetchCrewMissions(); // 미션 완료 상태 업데이트
      }
    } catch {
      alert("처리 중 오류가 발생했습니다.");
    } finally {
      setActionLoading(null);
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


        {/* Mission List (Passive Info for Leader, Action for Member) */}
        <div className="mt-8">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-foreground">크루 미션 정보</h3>
            <span className="text-xs text-foreground-muted">총 {total}개의 미션이 설정되어 있습니다</span>
          </div>
          <div className="mt-4 space-y-3">
            {crew.missions.map((mission, idx) => (
              <div
                key={mission.id}
                className="rounded-xl border border-neutral p-5 bg-white"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold bg-surface text-foreground-muted border border-neutral">
                      {idx + 1}
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">
                        {mission.title}
                      </p>
                      <p className="mt-1 text-sm text-foreground-muted">{mission.description}</p>
                      <p className="mt-2 text-[11px] font-medium text-primary bg-primary/5 inline-block px-2 py-0.5 rounded-md">
                        인당 리워드: {crew.deposit && crew.missionRewardRate ? Math.floor((crew.deposit * (crew.missionRewardRate / 100)) / total / 100) * 100 : 0}P
                      </p>
                    </div>
                  </div>
                  {!mission.completed && crew.createdBy !== currentUserId && (
                    <button
                      onClick={() => setModalMission({ id: mission.id, title: mission.title })}
                      className="btn-primary !py-2 !px-4 !text-xs !rounded-lg"
                    >
                      인증하기
                    </button>
                  )}
                  {mission.completed && crew.createdBy !== currentUserId && (
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
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface text-sm border border-neutral overflow-hidden relative">
                      {item.profiles?.avatar_url ? (
                        <Image src={item.profiles.avatar_url} alt="" fill className="object-cover" sizes="40px" />
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
                    {crew.createdBy === currentUserId && item.status === "pending" && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleVerifySubmission(item, "reject")}
                          disabled={!!actionLoading}
                          className="rounded-lg border border-neutral px-3 py-1.5 text-xs font-semibold text-foreground-muted hover:bg-neutral/10 disabled:opacity-50"
                        >
                          반려
                        </button>
                        <button
                          onClick={() => handleVerifySubmission(item, "approve")}
                          disabled={!!actionLoading}
                          className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                        >
                          {actionLoading === item.id ? "처리 중..." : "승인"}
                        </button>
                      </div>
                    )}
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
