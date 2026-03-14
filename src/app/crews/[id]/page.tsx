import { notFound } from "next/navigation";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import RoleBadge from "@/components/RoleBadge";
import { createClient } from "@/lib/supabase/server";
import JoinCrewButton from "@/components/JoinCrewButton";
import PreJoinChat from "@/components/PreJoinChat";
import ReportButton from "@/components/ReportButton";
import ReviewSection from "@/components/reviews/ReviewSection";

// A wrapper to extract user info for chat
async function ChatWrapper({ crewId, isLeader }: { crewId: string, isLeader: boolean }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || isLeader) return null;

  return <PreJoinChat crewId={crewId} isLeader={false} />;
}

export default async function CrewDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user: currentUser } } = await supabase.auth.getUser();

  const { data: crew, error } = await supabase
    .from('crews')
    .select('*, profiles:created_by(*), crew_members(*, profiles(*)), missions(*, mission_verifications(id))')
    .eq('id', id)
    .single();
    
  if (error) {
    console.error("Error fetching crew details:", error);
  }

  if (!crew) {
    notFound();
  }

  const activeMembersCount = (crew.crew_members as any[])?.filter((m) => m.status === 'active').length || 0;
  const progress = (activeMembersCount / crew.max_members) * 100;

  // 미션 달성률 계산
  const missions = (crew.missions as any[]) || [];
  const totalMissions = missions.length;
  const completedMissions = missions.filter((m: any) => m.mission_verifications?.length > 0).length;
  const missionProgress = totalMissions > 0 ? Math.round((completedMissions / totalMissions) * 100) : 0;

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="mx-auto max-w-3xl px-4 py-8">
        {/* Breadcrumb */}
        <nav className="mb-6 text-sm text-foreground-muted">
          <Link href="/crews" className="hover:text-primary">
            크루 찾기
          </Link>
          <span className="mx-2">/</span>
          <span className="text-foreground">{crew.title}</span>
        </nav>

        {/* Header */}
        <div className="flex flex-wrap items-center gap-2">
          {crew.status === 'disbanded' && (
            <span className="inline-flex items-center rounded-full bg-primary/20 px-3 py-1 text-xs font-bold text-primary">
              해산된 크루
            </span>
          )}
          <span className="inline-flex items-center rounded-full bg-secondary/20 px-3 py-1 text-xs font-medium text-secondary-text">
            {crew.category}
          </span>
          <RoleBadge roleType={crew.role_type} />
        </div>

        <h1 className={`mt-4 text-3xl font-bold ${crew.status === 'disbanded' ? 'text-foreground-muted line-through' : 'text-foreground'}`}>
          {crew.title}
        </h1>
        <p className="mt-3 leading-relaxed text-foreground-muted">
          {crew.description}
        </p>

        {/* Tags */}
        <div className="mt-4 flex flex-wrap gap-2">
          {(crew.tags || []).map((tag: string) => (
            <span key={tag} className="tag-chip">
              #{tag}
            </span>
          ))}
        </div>

        {/* Stats */}
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div className="card-flat">
            <p className="text-sm text-foreground-muted">크루원</p>
            <p className="mt-1 text-2xl font-bold text-foreground">
              {activeMembersCount}
              <span className="text-base font-normal text-foreground-muted">
                /{crew.max_members}명
              </span>
            </p>
            <div className="mt-2 progress-track">
              <div
                className="progress-fill"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          <div className="card-flat">
            <p className="text-sm text-foreground-muted">미션 달성률</p>
            <p className="mt-1 text-2xl font-bold text-foreground">{missionProgress}%</p>
            <div className="mt-2 progress-track">
              <div
                className={missionProgress >= 80 ? "progress-fill-success" : "progress-fill"}
                style={{ width: `${missionProgress}%` }}
              />
            </div>
          </div>
          <div className="card-flat">
            <p className="text-sm text-foreground-muted">역할 유형</p>
            <div className="mt-2">
              <RoleBadge roleType={crew.role_type} />
            </div>
          </div>
        </div>

        {/* 가입 비용 정보 */}
        <div className="mt-6 rounded-2xl border border-neutral bg-surface p-5">
          <h3 className="text-lg font-bold text-foreground">가입 및 참여 비용</h3>
          <div className="mt-3 space-y-3">
            <div className="flex justify-between items-center rounded-xl bg-background p-4 border border-neutral">
              <div>
                <p className="text-sm font-semibold text-foreground">플랫폼 참여금</p>
                <p className="text-xs text-foreground-muted mt-0.5">최종 승인 시 1회 차감됩니다.</p>
              </div>
              <p className="text-lg font-bold text-foreground">{crew.entry_points.toLocaleString()} P</p>
            </div>
            {crew.deposit > 0 && (
              <div className="flex justify-between items-center rounded-xl bg-background p-4 border border-neutral">
                <div>
                  <p className="text-sm font-semibold text-foreground">크루 예치금</p>
                  <p className="text-xs text-foreground-muted mt-0.5">미션 달성 보증금으로 사용됩니다.</p>
                </div>
                <p className="text-lg font-bold text-primary">{crew.deposit.toLocaleString()} P</p>
              </div>
            )}
            <div className="flex justify-between items-center rounded-xl bg-primary/10 p-4 border border-primary/20">
              <p className="font-bold text-primary">합계</p>
              <p className="text-xl font-black text-primary">{(crew.entry_points + (crew.deposit || 0)).toLocaleString()} P</p>
            </div>
          </div>
        </div>

        {/* 수익 분배 비율 (수익분배형 크루 전용) */}
        {crew.track === 'revenue_share' && (crew.leader_margin_rate > 0 || crew.mission_reward_rate > 0) && (
          <div className="mt-6 rounded-2xl border border-primary/30 bg-primary/5 p-5">
            <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
              수익 분배 비율
              <span className="text-xs font-normal text-foreground-muted bg-white px-2 py-0.5 rounded-md border border-neutral">고정값 · 변경 불가</span>
            </h3>
            <div className="mt-3 grid grid-cols-2 gap-4">
              <div className="rounded-xl bg-white border border-neutral p-4 text-center">
                <p className="text-sm text-foreground-muted">크루장 몫</p>
                <p className="mt-1 text-2xl font-bold text-primary">{crew.leader_margin_rate}%</p>
              </div>
              <div className="rounded-xl bg-white border border-neutral p-4 text-center">
                <p className="text-sm text-foreground-muted">크루원 몫 (균등 배분)</p>
                <p className="mt-1 text-2xl font-bold text-success-text">{crew.mission_reward_rate}%</p>
              </div>
            </div>
            {activeMembersCount > 1 && (
              <p className="mt-3 text-xs text-foreground-muted text-center">
                크루원 1인당 수익률: {(crew.mission_reward_rate / (activeMembersCount - 1)).toFixed(1)}% (현재 크루원 {activeMembersCount - 1}명 기준)
              </p>
            )}
          </div>
        )}

        {/* Missions */}
        {crew.missions && crew.missions.length > 0 && (
          <div className="mt-8">
            <h3 className="text-xl font-bold text-foreground">미션 목록</h3>
            <div className="mt-4 space-y-3">
              {(crew.missions as any[] || []).map((mission) => {
                const isCompleted = mission.mission_verifications?.length > 0;
                return (
                <div
                  key={mission.id}
                  className={`flex items-start gap-3 rounded-xl border p-4 ${isCompleted
                    ? "border-success bg-success/20"
                    : "border-neutral"
                    }`}
                >
                  <div
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${isCompleted
                      ? "bg-success-text text-white"
                      : "border-2 border-neutral"
                      }`}
                  >
                    {isCompleted && (
                      <svg
                        className="h-3 w-3"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={3}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    )}
                  </div>
                  <div>
                    <p
                      className={`font-medium ${isCompleted ? "text-success-text" : "text-foreground"
                        }`}
                    >
                      {mission.title}
                    </p>
                    <p className="mt-0.5 text-sm text-foreground-muted">
                      {mission.description}
                    </p>
                  </div>
                </div>
              );})}
            </div>
          </div>
        )}

        {/* Quick Links */}
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Link
            href={`/crews/${crew.id}/missions`}
            className="flex items-center gap-3 rounded-xl border border-neutral p-4 transition-colors hover:border-primary hover:shadow-sm"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary/20 text-lg">🎯</span>
            <div>
              <p className="font-semibold text-foreground">미션 인증</p>
              <p className="text-xs text-foreground-muted">미션 수행 및 인증하기</p>
            </div>
          </Link>
          <Link
            href={`/crews/${crew.id}/chat`}
            className="flex items-center gap-3 rounded-xl border border-neutral p-4 transition-colors hover:border-primary hover:shadow-sm"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-lg">💬</span>
            <div>
              <p className="font-semibold text-foreground">크루 채팅</p>
              <p className="text-xs text-foreground-muted">크루원과 소통하기</p>
            </div>
          </Link>
          <Link
            href={`/crews/${crew.id}/dashboard`}
            className="flex items-center gap-3 rounded-xl border border-neutral p-4 transition-colors hover:border-primary hover:shadow-sm"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/30 text-lg">📊</span>
            <div>
              <p className="font-semibold text-foreground">크루 대시보드</p>
              <p className="text-xs text-foreground-muted">수익·지출·배분 현황</p>
            </div>
          </Link>
          <ReportButton crewId={crew.id} targetUserId={crew.created_by} />
        </div>

        {/* CTA */}
        <div className="mt-8 flex gap-3">
          <JoinCrewButton crewId={crew.id} />
          <Link
            href="/crews"
            className="btn-outline py-4 px-6"
          >
            목록으로
          </Link>
        </div>

        {/* 리뷰 섹션 */}
        <ReviewSection crewId={crew.id} />
      </div>

      <Footer />
      
      {/* 사전 문의 채팅 */}
      <ChatWrapper crewId={crew.id} isLeader={crew.created_by === currentUser?.id} />
    </div>
  );
}
