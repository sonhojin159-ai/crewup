"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import DisclaimerModal from "@/components/DisclaimerModal";
import { createClient } from "@/lib/supabase/client";

interface SettlementTransfer {
  id: string;
  entry_id: string;
  from_user_id: string;
  to_user_id: string;
  amount: number;
  sender_confirmed: boolean;
  receiver_confirmed: boolean;
  from_profile: { nickname: string } | null;
  to_profile: { nickname: string } | null;
}

export default function LedgerPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();

  const [crew, setCrew] = useState<any>(null);
  const [entries, setEntries] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [totalMembers, setTotalMembers] = useState(0);
  const [settlements, setSettlements] = useState<Record<string, SettlementTransfer[]>>({});

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showLedgerDisclaimer, setShowLedgerDisclaimer] = useState(false);
  const [pendingApproveEntryId, setPendingApproveEntryId] = useState<string | null>(null);
  const [showSettlementDisclaimer, setShowSettlementDisclaimer] = useState(false);
  const [pendingSettlementEntryId, setPendingSettlementEntryId] = useState<string | null>(null);

  // New Entry Form State
  const [showNewEntryForm, setShowNewEntryForm] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [revenue, setRevenue] = useState(0);
  const [expense, setExpense] = useState(0);
  const [description, setDescription] = useState("");

  const fetchSettlements = useCallback(async (lockedEntries: any[]) => {
    const newSettlements: Record<string, SettlementTransfer[]> = {};
    for (const entry of lockedEntries) {
      const res = await fetch(`/api/crews/${id}/ledger/${entry.id}/settlement`);
      if (res.ok) {
        const data = await res.json();
        newSettlements[entry.id] = data;
      }
    }
    setSettlements(newSettlements);
  }, [id]);

  const fetchData = async () => {
    setIsLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUser(user);

    // 1. Crew Info (비율 포함)
    const { data: cData } = await supabase
      .from('crews')
      .select('*, crew_members(count)')
      .eq('id', id)
      .eq('crew_members.status', 'active')
      .single();

    if (cData) {
      if (cData.track !== 'revenue_share') {
        alert("이 크루는 수익 분배형 크루가 아닙니다.");
        router.push(`/crews/${id}`);
        return;
      }
      setCrew(cData);
      setTotalMembers(cData.crew_members[0].count);
    }

    // 2. Ledger Entries
    const res = await fetch(`/api/crews/${id}/ledger`);
    if (res.ok) {
      const data = await res.json();
      setEntries(data);
      // 확정된 장부의 정산 내역 조회
      const lockedEntries = data.filter((e: any) => e.is_locked);
      if (lockedEntries.length > 0) {
        fetchSettlements(lockedEntries);
      }
    }

    setIsLoading(false);
  };

  useEffect(() => {
    if (id) fetchData();
  }, [id]);

  const handleCreateEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const res = await fetch(`/api/crews/${id}/ledger`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, revenue, expense, description }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "장부 작성 실패");
      }

      alert("장부가 작성되었습니다.");
      setShowNewEntryForm(false);
      setRevenue(0);
      setExpense(0);
      setDescription("");
      fetchData();
    } catch (error: any) {
      alert(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApprove = async (entryId: string, approved: boolean) => {
    if (approved) {
      setPendingApproveEntryId(entryId);
      setShowLedgerDisclaimer(true);
      return;
    }

    if (!confirm("동의를 취소하시겠습니까?")) return;
    try {
      const res = await fetch(`/api/crews/${id}/ledger/${entryId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approved: false }),
      });
      if (!res.ok) throw new Error("승인 처리 실패");
      fetchData();
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleDisclaimerAgree = async () => {
    setShowLedgerDisclaimer(false);
    if (!pendingApproveEntryId) return;

    try {
      const res = await fetch(`/api/crews/${id}/ledger/${pendingApproveEntryId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approved: true }),
      });
      if (!res.ok) throw new Error("승인 처리 실패");
      fetchData();
    } catch (error: any) {
      alert(error.message);
    } finally {
      setPendingApproveEntryId(null);
    }
  };

  const handleCreateSettlementClick = (entryId: string) => {
    setPendingSettlementEntryId(entryId);
    setShowSettlementDisclaimer(true);
  };

  const handleSettlementDisclaimerAgree = async () => {
    setShowSettlementDisclaimer(false);
    if (!pendingSettlementEntryId) return;

    try {
      const res = await fetch(`/api/crews/${id}/ledger/${pendingSettlementEntryId}/settlement`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '정산 생성 실패');
      alert(`정산이 생성되었습니다.\n크루장 몫: ${data.leaderShare?.toLocaleString()}원\n크루원 1인당: ${data.perMemberShare?.toLocaleString()}원`);
      fetchData();
    } catch (error: any) {
      alert(error.message);
    } finally {
      setPendingSettlementEntryId(null);
    }
  };

  const handleSettlementConfirm = async (entryId: string, transferId: string, action: 'confirm_sent' | 'confirm_received') => {
    const msg = action === 'confirm_sent' ? '송금 완료로 표시하시겠습니까?' : '입금 확인하시겠습니까?';
    if (!confirm(msg)) return;

    try {
      const res = await fetch(`/api/crews/${id}/ledger/${entryId}/settlement`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transferId, action }),
      });
      if (!res.ok) throw new Error('처리 실패');
      fetchData();
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleFileUpload = async (entryId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isVideo = file.type.startsWith('video/');
    const maxSize = isVideo ? 50 * 1024 * 1024 : 5 * 1024 * 1024;
    if (file.size > maxSize) {
      alert(isVideo ? "동영상 파일 크기는 50MB 이하여야 합니다." : "이미지 파일 크기는 5MB 이하여야 합니다.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`/api/crews/${id}/ledger/${entryId}/evidence`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("업로드 실패");
      alert("증빙 자료가 업로드되었습니다.");
      fetchData();
    } catch (error: any) {
      alert(error.message);
    }
  };

  if (isLoading) return <div className="py-20 text-center">로딩 중...</div>;
  if (!crew) return null;

  const isLeader = currentUser?.id === crew.created_by;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      <main className="flex-1 mx-auto max-w-4xl px-4 py-8 w-full">
        <nav className="mb-6 text-sm text-foreground-muted">
          <Link href={`/crews/${crew.id}`} className="hover:text-primary">{crew.title}</Link>
          <span className="mx-2">/</span>
          <span className="text-foreground">일일 투명 장부</span>
        </nav>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">투명 장부 기록</h1>
            <p className="mt-1 text-sm text-foreground-muted">매출과 지출을 투명하게 공개하고 팀원들의 동의를 받습니다.</p>
          </div>
          {isLeader && !showNewEntryForm && (
            <button onClick={() => setShowNewEntryForm(true)} className="btn-primary">
              새 장부 작성
            </button>
          )}
        </div>

        {/* New Entry Form */}
        {showNewEntryForm && isLeader && (
          <div className="mt-8 rounded-2xl border border-neutral p-6 bg-surface shadow-sm transition-all duration-300 ease-in-out">
            <h2 className="text-lg font-bold mb-4">새 장부 작성</h2>
            <form onSubmit={handleCreateEntry} className="space-y-4">
              <div>
                <label className="form-label">날짜</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} required className="form-input w-full md:w-auto" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="form-label text-success-text">일일 매출 (원)</label>
                  <input type="number" min={0} value={revenue} onChange={e => setRevenue(Number(e.target.value))} required className="form-input" />
                </div>
                <div>
                  <label className="form-label text-primary">일일 지출 (원)</label>
                  <input type="number" min={0} value={expense} onChange={e => setExpense(Number(e.target.value))} required className="form-input" />
                </div>
              </div>
              <div>
                <label className="form-label">내용 (비고)</label>
                <textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} className="form-input resize-none" placeholder="오늘의 특이사항이나 지출 내역을 설명해주세요." />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowNewEntryForm(false)} className="btn-outline">취소</button>
                <button type="submit" disabled={isSubmitting} className="btn-primary">{isSubmitting ? '진행 중...' : '작성 완료'}</button>
              </div>
            </form>
          </div>
        )}

        {/* Entries List */}
        <div className="mt-10 space-y-6">
          {entries.length === 0 ? (
            <div className="py-12 text-center border rounded-2xl border-dashed">
              <p className="text-foreground-muted">아직 작성된 장부가 없습니다.</p>
            </div>
          ) : (
            entries.map((entry) => {
              const approvedCount = entry.ledger_approvals?.filter((a: any) => a.approved).length || 0;
              const isLocked = entry.is_locked;
              const myApproval = entry.ledger_approvals?.find((a: any) => a.user_id === currentUser?.id);
              const hasApproved = myApproval?.approved === true;
              const netProfit = entry.revenue - entry.expense;

              return (
                <div key={entry.id} className={`rounded-2xl border p-5 ${isLocked ? 'bg-neutral/5 border-neutral/50' : 'bg-surface border-neutral'}`}>
                  {/* Header */}
                  <div className="flex flex-wrap justify-between items-start gap-4 pb-4 border-b border-neutral">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-bold text-foreground">
                          {new Date(entry.date).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })}
                        </h3>
                        {isLocked ? (
                          <span className="badge-success gap-1"><span className="text-[10px]">🔒</span> 확정됨</span>
                        ) : (
                          <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 border border-amber-200">
                            동의 대기중 ({approvedCount}/{totalMembers})
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-foreground-muted mt-1">
                        작성자: {entry.profiles?.nickname} 
                      </p>
                    </div>

                    {!isLocked && (
                      <div className="flex items-center gap-2">
                        {hasApproved ? (
                          <button onClick={() => handleApprove(entry.id, false)} className="btn-outline !py-1.5 !px-3 !text-xs">동의 취소</button>
                        ) : (
                          <button onClick={() => handleApprove(entry.id, true)} className="btn-primary !py-1.5 !px-3 !text-xs bg-success-text hover:bg-success-text/90">동의하기</button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Body: Financials */}
                  <div className="py-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-foreground-muted mb-1">매출</p>
                      <p className="text-xl font-bold text-success-text">+{entry.revenue.toLocaleString()}원</p>
                    </div>
                    <div>
                      <p className="text-sm text-foreground-muted mb-1">지출 / 비용</p>
                      <p className="text-xl font-bold text-primary">-{entry.expense.toLocaleString()}원</p>
                    </div>
                    <div className="md:border-l md:border-neutral md:pl-4">
                      <p className="text-sm text-foreground-muted mb-1">당일 순수익</p>
                      <p className={`text-xl font-bold border-b-2 inline-block pb-0.5 ${netProfit >= 0 ? "text-foreground border-foreground" : "text-primary border-primary"}`}>
                        {netProfit > 0 ? "+" : ""}{netProfit.toLocaleString()}원
                      </p>
                    </div>
                  </div>

                  {/* Body: Description */}
                  {entry.description && (
                    <div className="bg-neutral/10 rounded-xl p-3 text-sm text-foreground my-2">
                       {entry.description}
                    </div>
                  )}

                  {/* Settlement Section (확정된 장부) */}
                  {isLocked && netProfit > 0 && (
                    <div className="pt-4 mt-2 border-t border-neutral/50">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-semibold text-foreground">P2P 정산 내역</p>
                        {isLeader && (!settlements[entry.id] || settlements[entry.id].length === 0) && (
                          <button
                            onClick={() => handleCreateSettlementClick(entry.id)}
                            className="btn-primary !py-1.5 !px-3 !text-xs"
                          >
                            정산 생성하기
                          </button>
                        )}
                      </div>

                      {/* 분배 요약 */}
                      {crew && (
                        <div className="rounded-xl bg-neutral/10 p-3 mb-3">
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-foreground-muted">크루장 몫 ({crew.leader_margin_rate}%)</span>
                              <span className="font-semibold text-primary">{Math.floor(netProfit * crew.leader_margin_rate / 100).toLocaleString()}원</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-foreground-muted">크루원 몫 ({crew.mission_reward_rate}%)</span>
                              <span className="font-semibold text-success-text">{Math.floor(netProfit * crew.mission_reward_rate / 100).toLocaleString()}원</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* P2P 면책 안내 (상시 노출) */}
                      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 mb-3">
                        <p className="text-xs text-amber-800 leading-relaxed">
                          <strong>안내:</strong> 크루업은 장부 기록 및 정산 금액 산출 도구만 제공하며, 실제 송금에는 일체 관여하지 않습니다. 크루원 간 송금은 당사자 간 직접 수행하는 P2P 거래이며, 플랫폼은 송금의 이행·지연·누락에 대해 책임을 지지 않습니다.
                        </p>
                      </div>

                      {/* 송금 현황 */}
                      {settlements[entry.id] && settlements[entry.id].length > 0 ? (
                        <div className="space-y-2">
                          {settlements[entry.id].map((t) => {
                            const allDone = t.sender_confirmed && t.receiver_confirmed;
                            return (
                              <div key={t.id} className={`flex items-center justify-between rounded-xl border p-3 ${allDone ? 'border-success bg-success/10' : 'border-neutral'}`}>
                                <div className="flex items-center gap-2 text-sm">
                                  <span className="font-medium text-foreground">{t.from_profile?.nickname}</span>
                                  <span className="text-foreground-muted">&rarr;</span>
                                  <span className="font-medium text-foreground">{t.to_profile?.nickname}</span>
                                  <span className="font-bold text-primary">{t.amount.toLocaleString()}원</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  {allDone ? (
                                    <span className="badge-success text-xs">완료</span>
                                  ) : (
                                    <>
                                      {/* 보낸 사람 확인 */}
                                      {t.from_user_id === currentUser?.id && !t.sender_confirmed && (
                                        <button
                                          onClick={() => handleSettlementConfirm(entry.id, t.id, 'confirm_sent')}
                                          className="btn-primary !py-1 !px-2 !text-xs"
                                        >
                                          보냈어요
                                        </button>
                                      )}
                                      {t.sender_confirmed && (
                                        <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700 border border-blue-200">송금완료</span>
                                      )}
                                      {/* 받는 사람 확인 */}
                                      {t.to_user_id === currentUser?.id && !t.receiver_confirmed && (
                                        <button
                                          onClick={() => handleSettlementConfirm(entry.id, t.id, 'confirm_received')}
                                          className="btn-outline !py-1 !px-2 !text-xs !border-success-text !text-success-text"
                                        >
                                          받았어요
                                        </button>
                                      )}
                                      {t.receiver_confirmed && (
                                        <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700 border border-green-200">수령확인</span>
                                      )}
                                    </>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-xs text-foreground-muted">
                          {isLeader ? '위 버튼을 눌러 정산을 생성하세요.' : '크루장이 정산을 생성하면 여기에 표시됩니다.'}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Footer: Evidence */}
                  <div className="pt-4 mt-2 border-t border-neutral/50">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-foreground">증빙 자료 ({entry.evidence_urls?.length || 0})</p>
                      {isLeader && !isLocked && (
                        <div>
                          <input type="file" id={`file-${entry.id}`} accept="image/*,video/mp4,video/webm,video/quicktime" className="hidden" onChange={(e) => handleFileUpload(entry.id, e)} />
                          <label htmlFor={`file-${entry.id}`} className="cursor-pointer text-xs font-medium text-primary hover:underline">
                            + 자료 첨부
                          </label>
                        </div>
                      )}
                    </div>

                    {entry.evidence_urls && entry.evidence_urls.length > 0 && (
                      <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
                        {entry.evidence_urls.map((url: string, idx: number) => {
                          const isVideoFile = /\.(mp4|webm|mov)(\?|$)/i.test(url);
                          return isVideoFile ? (
                            <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="shrink-0 group relative h-20 w-20 overflow-hidden rounded-lg border border-neutral bg-black">
                              <video src={url} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                              <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors">
                                <span className="text-white text-lg">&#9654;</span>
                              </div>
                            </a>
                          ) : (
                            <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="shrink-0 group relative h-20 w-20 overflow-hidden rounded-lg border border-neutral">
                              <img src={url} alt="증빙" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                            </a>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>

      <Footer />

      {showLedgerDisclaimer && (
        <DisclaimerModal
          consentType="ledger_confirm"
          crewId={id}
          title="장부 확정 면책 동의"
          onAgree={handleDisclaimerAgree}
          onCancel={() => {
            setShowLedgerDisclaimer(false);
            setPendingApproveEntryId(null);
          }}
        />
      )}

      {showSettlementDisclaimer && (
        <DisclaimerModal
          consentType="settlement_disclaimer"
          crewId={id}
          title="P2P 정산 면책 동의"
          onAgree={handleSettlementDisclaimerAgree}
          onCancel={() => {
            setShowSettlementDisclaimer(false);
            setPendingSettlementEntryId(null);
          }}
        />
      )}
    </div>
  );
}
