"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import RoleBadge from "@/components/RoleBadge";
import { createClient } from "@/lib/supabase/client";
import { Crew } from "@/types/crew";
import PreJoinChat from "@/components/PreJoinChat";

// UI 임시 유지

export default function DashboardPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();

  const [crew, setCrew] = useState<Crew | null>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [pendingMembers, setPendingMembers] = useState<any[]>([]);
  const [escrowHolds, setEscrowHolds] = useState<any[]>([]);
  const [verifications, setVerifications] = useState<any[]>([]);
  const [chats, setChats] = useState<any[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  
  

  const fetchDashboardData = useCallback(async () => {
    setIsLoading(true);
    const supabase = createClient();
    
    // 1. 크루 정보 및 미션
    const { data: cData, error: cErr } = await supabase
      .from('crews')
      .select('*, missions(*)')
      .eq('id', id)
      .single();

    if (cErr || !cData) {
      console.error(cErr);
      setIsLoading(false);
      return;
    }
    
    setCrew({
      id: cData.id,
      title: cData.title,
      category: cData.category,
      roleType: cData.role_type,
      track: cData.track,
      description: cData.description,
      maxMembers: cData.max_members,
      tags: cData.tags || [],
      members: 0,
      missions: cData.missions || [],
      entryPoints: cData.entry_points,
      deposit: cData.deposit,
      leaderFeeDeposit: cData.leader_fee_deposit,
      leaderMarginRate: cData.leader_margin_rate,
      missionRewardRate: cData.mission_reward_rate,
      status: cData.status || 'active',
      createdBy: cData.created_by,
    });

    // 2. 멤버 목록 (Active & Pending)
    const { data: mData } = await supabase
      .from('crew_members')
      .select('*, profiles(nickname, avatar_url)')
      .eq('crew_id', id);
      
    if (mData) {
      setMembers(mData.filter(m => m.status === 'active'));
      setPendingMembers(mData.filter(m => m.status === 'pending'));
    }

    // 3. 에스크로 현황
    const { data: eData } = await supabase
      .from('escrow_holds')
      .select('id, crew_id, member_user_id, amount, released_amount, status, created_at')
      .eq('crew_id', id);
      
    if (eData) setEscrowHolds(eData);

    // 4. 미션 인증 내역 (해당 크루)
    const { data: vData } = await supabase
      .from('mission_verifications')
      .select('*, profiles(nickname)')
      .eq('crew_id', id);
      
    if (vData) setVerifications(vData);

    // 5. 사전 문의 내역
    const { data: cListData } = await supabase
      .from('crew_chats')
      .select('*, profiles:applicant_id(nickname, avatar_url)')
      .eq('crew_id', id)
      .order('updated_at', { ascending: false });
    
    if (cListData) setChats(cListData);

    setIsLoading(false);
  }, [id]);

  useEffect(() => {
    if (id) fetchDashboardData();
  }, [id, fetchDashboardData]);

  const handleApproveMember = async (memberId: string) => {
    if (!confirm("이 유저의 가입을 승인하시겠습니까?\n승인 시 유저의 포인트가 차감되며 에스크로에 보관됩니다.")) return;
    setIsProcessing(true);
    try {
      const res = await fetch(`/api/crews/${id}/approve/${memberId}`, { method: 'POST' });
      if (!res.ok) {
         const data = await res.json();
         throw new Error(data.error);
      }
      alert('승인 및 결제가 완료되었습니다.');
      fetchDashboardData();
    } catch (e: any) {
      alert(`승인 실패: ${e.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRejectMember = async (memberId: string, nickname: string) => {
    if (!confirm(`[${nickname}] 님의 가입 신청을 반려하시겠습니까?\n반려된 신청자는 이 크루에 재신청할 수 없습니다.`)) return;
    setIsProcessing(true);
    try {
      const res = await fetch(`/api/crews/${id}/reject/${memberId}`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      alert('신청이 반려되었습니다.');
      fetchDashboardData();
    } catch (e: any) {
      alert(`반려 실패: ${e.message}`);
    } finally {
      setIsProcessing(false);
    }
  };


  const handleDisband = async () => {
    if (!confirm("정말 크루를 해산하시겠습니까?\n남은 에스크로 금액은 크루원 전원에게 전액 환급되며, 이 작업은 되돌릴 수 없으며 크루는 삭제 상태로 전환됩니다.")) return;
    setIsProcessing(true);
    try {
      const res = await fetch(`/api/crews/${id}/disband`, { method: 'POST' });
      if (!res.ok) {
         const data = await res.json();
         throw new Error(data.error);
      }
      alert('크루가 성공적으로 해산되었습니다.');
      router.push('/crews');
    } catch (e: any) {
      alert(`해산 실패: ${e.message}`);
      setIsProcessing(false);
    }
  };

  if (isLoading) return <div className="py-20 text-center">로딩 중...</div>;
  if (!crew) return <div className="py-20 text-center">크루를 찾을 수 없습니다</div>;

  // amount = entry_points(플랫폼 수익) + deposit(예치금). 예치액은 deposit 부분만 표시.
  const entryPoints = crew?.entryPoints || 0;
  const totalEscrow = escrowHolds.reduce((sum) => sum + (crew?.deposit || 0), 0);
  const releasedEscrow = escrowHolds.reduce((sum, h) => sum + Math.max(0, h.released_amount - entryPoints), 0);
  const remainEscrow = totalEscrow - releasedEscrow;

  const missions = crew.missions || [];
  const verifiedMissionIds = verifications.filter(v => v.distribution_status === 'completed').map(v => v.mission_id);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="mx-auto max-w-4xl px-4 py-8">
        <nav className="mb-6 text-sm text-foreground-muted">
          <Link href="/crews" className="hover:text-primary">크루 찾기</Link>
          <span className="mx-2">/</span>
          <Link href={`/crews/${crew.id}`} className="hover:text-primary">{crew.title}</Link>
          <span className="mx-2">/</span>
          <span className="text-foreground">대시보드</span>
        </nav>

        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-2xl font-bold text-foreground">{crew.title}</h2>
          <RoleBadge roleType={crew.roleType} />
        </div>
        
        {/* --- 1. 참여 신청 관리 --- */}
        <div className="mt-8">
          <h3 className="text-xl font-bold text-foreground">참여 신청 내역</h3>
          <div className="mt-4 space-y-3">
            {pendingMembers.length === 0 ? (
              <p className="text-sm text-foreground-muted">대기 중인 신청이 없습니다.</p>
            ) : (
              pendingMembers.map((pm) => (
                 <div key={pm.id} className="flex items-center justify-between rounded-xl border border-neutral p-4">
                  <div>
                    <p className="font-medium">{pm.profiles?.nickname || '익명'}</p>
                    <p className="text-xs text-foreground-muted">신청일: {new Date(pm.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      disabled={isProcessing}
                      onClick={() => handleRejectMember(pm.id, pm.profiles?.nickname || '익명')}
                      className="rounded-lg border border-red-300 px-4 py-2 text-sm text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
                    >
                      반려
                    </button>
                    <button
                      disabled={isProcessing}
                      onClick={() => handleApproveMember(pm.id)}
                      className="btn-primary !px-4 !py-2 text-sm"
                    >
                      결제 및 승인
                    </button>
                  </div>
                 </div>
              ))
            )}
          </div>
        </div>

        {/* --- 2. 사전 문의 관리 --- */}
        <div className="mt-8">
          <h3 className="text-xl font-bold text-foreground">사전 문의 내역</h3>
          <p className="text-sm text-foreground-muted mt-1">가입 신청 전 궁금한 점을 문의한 예비 크루원들입니다.</p>
          <div className="mt-4 space-y-4">
            {chats.length === 0 ? (
              <p className="text-sm text-foreground-muted">문의 내역이 없습니다.</p>
            ) : (
              chats.map((chat) => (
                <div key={chat.id} className="rounded-xl border border-neutral p-5 bg-surface shadow-sm">
                  <div className="flex items-center justify-between border-b border-neutral pb-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                        {chat.profiles?.nickname?.[0] || '?'}
                      </div>
                      <div>
                        <p className="font-bold text-foreground">{chat.profiles?.nickname || '익명'}</p>
                        <p className="text-xs text-foreground-muted">최근 활동: {new Date(chat.updated_at).toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                  <PreJoinChat crewId={id} isLeader={true} applicantId={chat.applicant_id} />
                </div>
              ))
            )}
          </div>
        </div>

        {/* --- 트랙별 분기 --- */}
        {crew.track === 'mission' ? (
          <>

            {/* --- 3. 에스크로 현황 --- */}
            <div className="mt-8">
              <h3 className="text-xl font-bold text-foreground">참여금 에스크로 현황</h3>
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <div className="card-flat">
                  <p className="text-sm text-foreground-muted">총 예치액</p>
                  <p className="mt-1 text-2xl font-bold text-primary">{totalEscrow.toLocaleString()}P</p>
                </div>
                <div className="card-flat">
                  <p className="text-sm text-foreground-muted">배분 완료액</p>
                  <p className="mt-1 text-2xl font-bold text-success-text">{releasedEscrow.toLocaleString()}P</p>
                </div>
                <div className="card-flat border-primary bg-primary/5">
                  <p className="text-sm text-foreground-muted">잔여 에스크로</p>
                  <p className="mt-1 text-2xl font-bold text-primary">{remainEscrow.toLocaleString()}P</p>
                </div>
              </div>
              
              <div className="mt-4 p-4 rounded-xl border border-primary/20 bg-primary/5">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm font-bold text-primary">크루장 보호 예치금 현황</p>
                    <p className="text-xs text-foreground-muted mt-1">해산 시 멤버 보호를 위해 선입금된 금액입니다.</p>
                  </div>
                  <p className="text-xl font-bold text-primary">{crew.leaderFeeDeposit?.toLocaleString()} P</p>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="mt-8">
            <h3 className="text-xl font-bold text-foreground">수익 분배 및 장부 관리</h3>
            <div className="mt-4 p-6 rounded-2xl border border-primary/30 bg-primary/5">
              <h4 className="text-lg font-bold text-primary">일일 투명 장부</h4>
              <p className="mt-2 text-sm text-foreground-muted max-w-lg mb-6">
                매일 크루장이 크루의 영업 매출과 지출을 기록하고 증빙 자료를 업로드합니다.
                크루원 전원이 동의하면 당일 장부가 확정(Lock)되며 투명하게 관리됩니다.
              </p>
              <Link href={`/crews/${crew.id}/ledger`} className="btn-primary !px-6">
                장부 확인 및 작성하기
              </Link>
            </div>
          </div>
        )}

        {/* --- 4. 위험 영역 (해산) --- */}
        <div className="mt-12 rounded-2xl border border-primary/30 bg-primary/5 p-6">
           <h3 className="text-lg font-bold text-primary mb-2">위험 영역</h3>
           <p className="text-sm text-foreground-muted mb-4">
             크루를 해산하면 남은 에스크로 금액은 크루원 전원에게 전액 환급되며 크루는 소멸됩니다. 이 작업은 되돌릴 수 없습니다.
           </p>
           <button 
             disabled={isProcessing}
             onClick={handleDisband}
             className="btn-destructive !w-auto !px-6"
           >
             크루 해산 (전액 환급)
           </button>
        </div>

      </div>
      <Footer />
    </div>
  );
}
