import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CrewCard from "@/components/CrewCard";
import { CATEGORIES } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { CrewSummary, RoleType } from "@/types/crew";

export const revalidate = 30;

export default async function Home() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("crews")
    .select("*, crew_members(count)")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(6);

  const crews: CrewSummary[] = (data || []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    title: row.title as string,
    category: row.category as string,
    roleType: (row.role_type as string) as RoleType,
    description: row.description as string,
    maxMembers: row.max_members as number,
    tags: (row.tags as string[]) || [],
    track: row.track as CrewSummary["track"],
    status: (row.status as string) || 'active',
    members: ((row.crew_members as { count: number }[])?.[0]?.count) || 0,
  }));
  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* ── Hero ────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-surface via-background to-secondary/10 px-4 py-14 text-center md:py-24">
        {/* Warm decorative blobs */}
        <div className="pointer-events-none absolute -left-24 -top-24 h-64 w-64 rounded-full bg-secondary/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 -right-16 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />

        <div className="relative">
          <p className="mx-auto mb-4 inline-block rounded-full bg-secondary/20 px-4 py-1.5 text-xs font-semibold text-secondary-text tracking-wide">
            지금 바로 시작하는 부업 크루 매칭
          </p>
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-foreground md:text-5xl">
            함께하면 더 쉬운 부업,
            <br />
            <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">크루</span>에서 시작하세요
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-[15px] leading-relaxed text-foreground-muted">
            혼자 시작하기 막막한 부업, 같은 목표를 가진 크루와 함께라면 다릅니다.
            지금 바로 크루를 찾아보세요.
          </p>

          {/* Search bar */}
          <div className="mx-auto mt-8 flex max-w-md gap-2">
            <input
              type="text"
              placeholder="어떤 부업에 관심 있으세요?"
              className="form-input flex-1 !border-secondary/50 !bg-white shadow-sm"
              aria-label="크루 검색"
            />
            <Link href="/crews" className="btn-primary shrink-0 shadow-md">
              검색
            </Link>
          </div>

          {/* Social proof — trust signal */}
          <p className="mt-6 text-xs text-foreground-muted">
            첫 번째 크루의 주인공이 되어보세요
          </p>
        </div>
      </section>

      {/* ── Category chips ──────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex gap-2 overflow-x-auto pb-2" role="list" aria-label="카테고리 필터">
          {CATEGORIES.map((cat) => (
            <Link
              key={cat.name}
              href={cat.name === "전체" ? "/crews" : `/crews?category=${cat.name}`}
              className="badge-category"
              role="listitem"
            >
              <span aria-hidden="true">{cat.emoji}</span>
              {cat.name}
            </Link>
          ))}
        </div>
      </section>

      {/* ── Crew list or Empty state ──────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 pb-16">
        {crews.length > 0 ? (
          <>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-foreground">최근 크루</h2>
              <Link href="/crews" className="text-sm font-medium text-primary hover:underline">
                전체 보기 →
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {crews.map((crew) => (
                <CrewCard key={crew.id} crew={crew} />
              ))}
            </div>
          </>
        ) : (
          <div className="empty-state rounded-2xl border border-neutral bg-surface p-10 text-center">
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary/15 text-3xl" aria-hidden="true">
              🚀
            </span>
            <h2 className="mt-5 text-xl font-bold text-foreground">아직 크루가 없어요</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-foreground-muted">
              첫 번째 크루를 만들고 함께 부업을 시작할 동료를 모아보세요.
            </p>
            <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Link href="/crews/new" className="btn-primary shadow-md">
                크루 만들기
              </Link>
              <Link href="/crews" className="btn-outline">
                크루 둘러보기
              </Link>
            </div>
          </div>
        )}
      </section>

      {/* ── Value proposition strip ─────────────────────── */}
      <section className="bg-gradient-to-b from-surface/60 to-background px-4 py-14">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-3 text-center text-2xl font-bold text-foreground">
            크루업이 특별한 이유
          </h2>
          <p className="mx-auto mb-10 max-w-md text-center text-sm text-foreground-muted">
            안전하고 체계적인 부업 크루 시스템으로 신뢰를 쌓아갑니다
          </p>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                emoji: "🤝",
                title: "검증된 크루원",
                desc: "실명 인증과 미션 달성률로 신뢰를 쌓아가는 크루원들.",
                accent: "bg-secondary/15 border-secondary/30",
              },
              {
                emoji: "🎯",
                title: "미션 기반 운영",
                desc: "단계별 미션 달성으로 부업 성과를 체계적으로 관리합니다.",
                accent: "bg-success/20 border-success/40",
              },
              {
                emoji: "💰",
                title: "포인트 리워드",
                desc: "미션 완료 시 포인트를 받고, 다양한 기프티콘으로 교환하세요.",
                accent: "bg-primary/8 border-primary/20",
              },
            ].map((item) => (
              <div key={item.title} className="card text-center">
                <span className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl text-2xl ${item.accent}`} aria-hidden="true">
                  {item.emoji}
                </span>
                <h3 className="mt-4 text-lg font-semibold text-foreground">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-foreground-muted">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ──────────────────────────────────── */}
      <section className="relative overflow-hidden px-4 py-16 text-center">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-secondary/8 to-transparent" />
        <div className="relative">
          <h2 className="text-2xl font-bold text-foreground md:text-3xl">
            지금 바로 크루를 만들어보세요
          </h2>
          <p className="mx-auto mt-3 max-w-sm text-[15px] text-foreground-muted">
            새로운 부업의 시작, 혼자가 아닌 크루와 함께라면 훨씬 쉬워집니다.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link href="/crews/new" className="btn-primary btn-primary-lg w-full shadow-lg shadow-primary/20 sm:w-auto">
              크루 만들기
            </Link>
            <Link href="/crews" className="btn-outline w-full sm:w-auto py-4 px-8 text-base">
              크루 둘러보기
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
