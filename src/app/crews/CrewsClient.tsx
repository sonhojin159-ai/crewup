"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import CrewCard from "@/components/CrewCard";
import { CATEGORIES } from "@/lib/data";
import { CrewSummary, RoleType } from "@/types/crew";

const ROLE_FILTERS: { value: RoleType | "all"; label: string }[] = [
  { value: "all", label: "전체 역할" },
  { value: "investor", label: "A형 · 투자자" },
  { value: "operator", label: "B형 · 실행자" },
  { value: "both", label: "A+B · 모두" },
];

const TRACK_FILTERS = [
  { value: "all", label: "전체 트랙" },
  { value: "mission", label: "🔥 미션 달성형" },
  { value: "revenue_share", label: "💰 수익 분배형" },
] as const;

interface CrewRow {
  id: string;
  title: string;
  category: string;
  role_type: string;
  track: "mission" | "revenue_share";
  description: string;
  max_members: number;
  tags: string[];
  status: string;
  crew_members: { count: number }[];
}

function mapCrewRow(crew: CrewRow): CrewSummary {
  return {
    id: crew.id,
    title: crew.title,
    category: crew.category,
    roleType: crew.role_type as RoleType,
    track: crew.track,
    description: crew.description,
    maxMembers: crew.max_members,
    tags: crew.tags || [],
    members: crew.crew_members?.[0]?.count || 0,
    status: crew.status,
  };
}

interface CrewsClientProps {
  initialCrews: CrewSummary[];
}

export default function CrewsClient({ initialCrews }: CrewsClientProps) {
  const [selectedCategory, setSelectedCategory] = useState("전체");
  const [selectedRole, setSelectedRole] = useState<RoleType | "all">("all");
  const [selectedTrack, setSelectedTrack] = useState<"all" | "mission" | "revenue_share">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [crews, setCrews] = useState<CrewSummary[]>(initialCrews);
  const [isLoading, setIsLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  const isInitialRender = useRef(true);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery]);

  useEffect(() => {
    // Skip fetching on initial render — we already have server data
    if (isInitialRender.current) {
      isInitialRender.current = false;
      return;
    }

    const controller = new AbortController();

    const fetchCrews = async () => {
      setIsLoading(true);
      try {
        const queryParams = new URLSearchParams();
        if (selectedCategory) queryParams.append("category", selectedCategory);
        if (selectedRole) queryParams.append("role", selectedRole);
        if (selectedTrack) queryParams.append("track", selectedTrack);
        if (debouncedSearch) queryParams.append("search", debouncedSearch);

        const res = await fetch(`/api/crews?${queryParams.toString()}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error("Failed to fetch crews");

        const data: CrewRow[] = await res.json();
        setCrews(data.map(mapCrewRow));
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCrews();
    return () => controller.abort();
  }, [selectedCategory, selectedRole, selectedTrack, debouncedSearch]);

  return (
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

      {/* Category filter */}
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

      {/* Role filter */}
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

      {/* Track filter */}
      <div
        className="mt-3 flex flex-wrap gap-2"
        role="group"
        aria-label="트랙 필터"
      >
        {TRACK_FILTERS.map((t) => (
          <button
            key={t.value}
            onClick={() => setSelectedTrack(t.value as "all" | "mission" | "revenue_share")}
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
  );
}
