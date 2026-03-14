"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CrewCard from "@/components/CrewCard";
import { CATEGORIES } from "@/lib/data";
import { Crew, RoleType } from "@/types/crew";

const ROLE_FILTERS: { value: RoleType | "all"; label: string }[] = [
  { value: "all", label: "전체 역할" },
  { value: "investor", label: "A형 · 투자자" },
  { value: "operator", label: "B형 · 실행자" },
  { value: "both", label: "A+B · 모두" },
];

export default function CrewsPage() {
  const [selectedCategory, setSelectedCategory] = useState("전체");
  const [selectedRole, setSelectedRole] = useState<RoleType | "all">("all");
  const [selectedTrack, setSelectedTrack] = useState<"all" | "mission" | "revenue_share">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [crews, setCrews] = useState<Crew[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchCrews = async () => {
      setIsLoading(true);
      try {
        const queryParams = new URLSearchParams();
        if (selectedCategory) queryParams.append('category', selectedCategory);
        if (selectedRole) queryParams.append('role', selectedRole);
        if (selectedTrack) queryParams.append('track', selectedTrack);
        if (searchQuery) queryParams.append('search', searchQuery);

        const res = await fetch(`/api/crews?${queryParams.toString()}`);
        if (!res.ok) throw new Error('Failed to fetch crews');

        const data = await res.json();
        interface CrewRow {
          id: string;
          title: string;
          category: string;
          role_type: string;
          track: 'mission' | 'revenue_share';
          description: string;
          max_members: number;
          tags: string[];
          crew_members: { count: number }[];
        }
        const mappedData: Crew[] = data.map((crew: CrewRow) => ({
          id: crew.id,
          title: crew.title,
          category: crew.category,
          roleType: crew.role_type as RoleType,
          track: crew.track,
          description: crew.description,
          maxMembers: crew.max_members,
          tags: crew.tags || [],
          members: crew.crew_members?.[0]?.count || 0,
        }));
        setCrews(mappedData);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCrews();
  }, [selectedCategory, selectedRole, selectedTrack, searchQuery]);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="mx-auto max-w-6xl px-4 py-8">
        {/* Page header */}
        <h1 className="text-2xl font-bold text-foreground md:text-3xl">크루 찾기</h1>
        <p className="mt-1.5 text-[15px] text-foreground-muted">
          나에게 맞는 부업 크루를 찾아보세요
        </p>

        {/* Search input */}
        <div className="mt-6">
          <label htmlFor="crew-search" className="sr-only">크루 검색</label>
          <input
            id="crew-search"
            type="text"
            placeholder="크루명, 태그로 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="form-input"
          />
        </div>

        {/* Category filter — primary filter, filled pill style */}
        <div
          className="mt-5 flex gap-2 overflow-x-auto pb-2"
          role="group"
          aria-label="카테고리 필터"
        >
          {CATEGORIES.map((cat) => (
            <button
              key={cat.name}
              onClick={() => setSelectedCategory(cat.name)}
              className={
                selectedCategory === cat.name
                  ? "badge-category-active"
                  : "badge-category"
              }
              aria-pressed={selectedCategory === cat.name}
            >
              <span aria-hidden="true">{cat.emoji}</span>
              {cat.name}
            </button>
          ))}
        </div>

        {/* Role filter — secondary filter, ghost pill style */}
        <div
          className="mt-3 flex flex-wrap gap-2"
          role="group"
          aria-label="역할 필터"
        >
          {ROLE_FILTERS.map((role) => (
            <button
              key={role.value}
              onClick={() => setSelectedRole(role.value)}
              className={`rounded-lg px-3 py-2 text-xs font-medium transition-colors ${selectedRole === role.value
                  ? "bg-foreground text-background ring-1 ring-foreground"
                  : "bg-neutral/20 text-foreground-muted hover:bg-neutral/40 hover:text-foreground"
                }`}
              aria-pressed={selectedRole === role.value}
            >
              {role.label}
            </button>
          ))}
        </div>
        
        {/* Track filter — tertiary filter */}
        <div
          className="mt-3 flex flex-wrap gap-2"
          role="group"
          aria-label="트랙 필터"
        >
          {[
            { value: "all", label: "전체 트랙" },
            { value: "mission", label: "🔥 미션 달성형" },
            { value: "revenue_share", label: "💰 수익 분배형" },
          ].map((t) => (
            <button
              key={t.value}
              onClick={() => setSelectedTrack(t.value as any)}
              className={`rounded-lg px-3 py-2 text-xs font-medium transition-colors ${selectedTrack === t.value
                  ? "bg-foreground text-background ring-1 ring-foreground"
                  : "bg-neutral/20 text-foreground-muted hover:bg-neutral/40 hover:text-foreground"
                }`}
              aria-pressed={selectedTrack === t.value}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="mt-8">
          <p className="mb-4 text-sm text-foreground-muted">
            {isLoading ? "로딩 중..." : `${crews.length}개의 크루`}
          </p>

          {isLoading ? (
            <div className="py-20 text-center text-foreground-muted">
              크루 목록을 불러오는 중입니다...
            </div>
          ) : crews.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {crews.map((crew) => (
                <CrewCard key={crew.id} crew={crew} />
              ))}
            </div>
          ) : (
            /* Empty state — icon + heading + body + CTA */
            <div className="empty-state">
              <div className="empty-state-icon">🔍</div>
              <h2 className="text-lg font-semibold text-foreground">
                조건에 맞는 크루가 없습니다
              </h2>
              <p className="mt-2 max-w-xs text-sm text-foreground-muted">
                필터를 변경하거나, 원하는 크루가 없다면 직접 만들어보세요!
              </p>
              <Link href="/crews/new" className="btn-primary mt-6">
                크루 만들기
              </Link>
            </div>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
}
