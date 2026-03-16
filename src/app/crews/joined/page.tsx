"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CrewCard from "@/components/CrewCard";
import { CrewSummary, RoleType } from "@/types/crew";

export default function JoinedCrewsPage() {
  const [crews, setCrews] = useState<CrewSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'active' | 'ended'>('active');

  useEffect(() => {
    const fetchJoinedCrews = async () => {
      setIsLoading(true);
      try {
        const res = await fetch("/api/crews?filter=joined");
        if (!res.ok) throw new Error("Failed to fetch joined crews");

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
          status: string;
          crew_members: { count: number }[];
        }

        const mappedData: CrewSummary[] = data.map((crew: CrewRow) => ({
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
        }));
        setCrews(mappedData);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchJoinedCrews();
  }, []);

  const filteredCrews = crews.filter(crew => {
    if (activeTab === 'active') {
      return crew.status === 'active';
    } else {
      return crew.status === 'abandoned' || crew.status === 'completed';
    }
  });

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground md:text-3xl">내가 참여한 크루</h1>
            <p className="mt-1.5 text-[15px] text-foreground-muted">
              참여 중이거나 완료된 크루 목록입니다
            </p>
          </div>
          <Link href="/crews" className="btn-outline text-sm">
            새로운 크루 찾기
          </Link>
        </div>

        {/* Status Tabs */}
        <div className="mt-8 flex gap-4 border-b border-neutral">
          <button
            onClick={() => setActiveTab('active')}
            className={`pb-3 text-sm font-semibold transition-colors ${
              activeTab === 'active' 
                ? "border-b-2 border-primary text-primary" 
                : "text-foreground-muted hover:text-foreground"
            }`}
          >
            참여 중인 크루 ({crews.filter(c => c.status === 'active').length})
          </button>
          <button
            onClick={() => setActiveTab('ended')}
            className={`pb-3 text-sm font-semibold transition-colors ${
              activeTab === 'ended' 
                ? "border-b-2 border-primary text-primary" 
                : "text-foreground-muted hover:text-foreground"
            }`}
          >
            종료/중단된 크루 ({crews.filter(c => c.status === 'abandoned' || c.status === 'completed').length})
          </button>
        </div>

        <div className="mt-8">
          {isLoading ? (
            <div className="py-20 text-center text-foreground-muted">
              참여한 크루 목록을 불러오는 중입니다...
            </div>
          ) : filteredCrews.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredCrews.map((crew) => (
                <div key={crew.id} className="relative">
                  <CrewCard crew={crew} />
                  {crew.status === 'abandoned' && (
                    <div className="absolute top-2 right-2 rounded-lg bg-destructive/10 px-2 py-1 text-[10px] font-bold text-destructive border border-destructive/20 backdrop-blur-sm">
                      운영 중단됨
                    </div>
                  )}
                  {crew.status === 'completed' && (
                    <div className="absolute top-2 right-2 rounded-lg bg-primary/10 px-2 py-1 text-[10px] font-bold text-primary border border-primary/20 backdrop-blur-sm">
                      활동 종료
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">
                {activeTab === 'active' ? "🏃‍♂️" : "📄"}
              </div>
              <h2 className="text-lg font-semibold text-foreground">
                {activeTab === 'active' ? "참여 중인 크루가 없습니다" : "종료된 크루 내역이 없습니다"}
              </h2>
              <p className="mt-2 max-w-xs text-sm text-foreground-muted">
                {activeTab === 'active' 
                  ? "크루업에서 나에게 맞는 부업 크루를 찾아보세요!" 
                  : "참여한 크루의 활동 기록이 여기에 표시됩니다."}
              </p>
              {activeTab === 'active' && (
                <Link href="/crews" className="btn-primary mt-6">
                  크루 구경가기
                </Link>
              )}
            </div>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
}
