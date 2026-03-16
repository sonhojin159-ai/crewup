"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { CATEGORIES } from "@/lib/data";
import { RoleType } from "@/types/crew";
import DisclaimerModal from "@/components/DisclaimerModal";

const MISSION_PRESETS: Record<string, string[]> = {
  "온라인 판매": ["스토어 개설하기", "첫 상품 등록", "첫 주문 달성", "월 매출 목표 설정"],
  "배달": ["라이더 등록 완료", "첫 배달 완료", "주간 10건 달성", "단골 구역 확보"],
  "프리랜서": ["포트폴리오 정리", "프로필 등록", "첫 프로젝트 수주", "후기 1건 확보"],
  "콘텐츠": ["채널/블로그 개설", "콘텐츠 10개 발행", "수익화 신청", "첫 수익 달성"],
  "투자": ["증권 계좌 개설", "종목 분석 1건", "첫 투자 실행", "수익률 리포트 작성"],
  "과외/교육": ["과외 프로필 작성", "첫 학생 매칭", "수업 4회 완료", "후기 확보"],
};

const ROLE_OPTIONS: { value: RoleType; label: string; desc: string }[] = [
  { value: "investor", label: "A형 · 투자자", desc: "자본 투자 중심" },
  { value: "operator", label: "B형 · 실행자", desc: "시간·노하우 중심" },
  { value: "both", label: "A+B · 모두", desc: "모두 환영" },
];

export default function NewCrewPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [track, setTrack] = useState<'mission' | 'revenue_share'>('mission');
  const [roleType, setRoleType] = useState<RoleType>("both");
  const [description, setDescription] = useState("");
  const [maxMembers, setMaxMembers] = useState(6);
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [missions, setMissions] = useState<{ title: string }[]>([]);
  const [deposit, setDeposit] = useState(0);
  const [activityPeriodDays, setActivityPeriodDays] = useState(7);
  
  // Entry fee is auto-calculated based on max members
  const entryPoints = maxMembers < 6 ? 3000 : 5000;
  const leaderFeeDeposit = maxMembers * entryPoints;
  
  const [leaderMarginRate, setLeaderMarginRate] = useState(30);
  const [missionRewardRate, setMissionRewardRate] = useState(70);
  const [agreeLedger, setAgreeLedger] = useState(false);

  const categories = CATEGORIES.filter((c) => c.name !== "전체");

  const handleCategoryChange = (cat: string) => {
    setCategory(cat);
    const presets = MISSION_PRESETS[cat] || [];
    setMissions(presets.map((t) => ({ title: t })));
  };

  const addTag = () => {
    const trimmed = tagInput.trim();
    if (trimmed && !tags.includes(trimmed) && tags.length < 5) {
      setTags([...tags, trimmed]);
      setTagInput("");
    }
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const addMission = () => {
    setMissions([...missions, { title: "" }]);
  };

  const updateMissionTitle = (index: number, value: string) => {
    const updated = [...missions];
    updated[index] = { ...updated[index], title: value };
    setMissions(updated);
  };

  const removeMission = (index: number) => {
    setMissions(missions.filter((_, i) => i !== index));
  };

  const rateSum = leaderMarginRate + missionRewardRate;
  const isRateValid = rateSum === 100;

  const handleLeaderMarginChange = (val: number) => {
    setLeaderMarginRate(val);
    setMissionRewardRate(100 - val);
  };

  const handleMissionRewardChange = (val: number) => {
    setMissionRewardRate(val);
    setLeaderMarginRate(100 - val);
  };

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(false);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!title || !category || !description) {
      alert("크루 이름, 카테고리, 크루 소개는 필수입니다.");
      return;
    }

    if (track === 'mission' && !isRateValid) {
      alert("크루장 마진율과 미션 리워드 합산이 정확히 100%여야 합니다.");
      return;
    }

    if (track === 'mission' && entryPoints > 0 && missions.filter((m) => m.title.trim()).length === 0) {
      alert("미션 달성형 크루는 미션을 1개 이상 설정해야 합니다.");
      return;
    }

    if (track === 'revenue_share' && !agreeLedger) {
      alert("투명 장부 운영 동의는 필수입니다.");
      return;
    }

    setShowDisclaimer(true);
  };

  const handleDisclaimerAgree = () => {
    setShowDisclaimer(false);
    setShowConfirmModal(true);
  };

  const executeSubmit = async () => {
    setIsSubmitting(true);
    setShowConfirmModal(false);

    try {
      const res = await fetch("/api/crews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          category,
          roleType,
          track,
          description,
          maxMembers,
          tags,
          entryPoints,
          leaderMarginRate,
          missionRewardRate,
          deposit,
          activityDays: activityPeriodDays,
          missions: track === 'mission' ? missions.filter((m) => m.title.trim()) : undefined,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "생성에 실패했습니다.");
      }

      const newCrew = await res.json();
      router.push(`/crews/${newCrew.id}`);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="mx-auto max-w-2xl px-4 py-8 md:py-12">
        {/* Page header */}
        <h1 className="text-2xl font-bold text-foreground md:text-3xl">크루 만들기</h1>
        <p className="mt-1.5 text-[15px] text-foreground-muted">
          새로운 부업 크루를 만들고 함께할 동료를 모집하세요
        </p>

        <form onSubmit={handleFormSubmit} className="mt-8 space-y-6">

          {/* ── 크루 이름 ── */}
          <div>
            <label htmlFor="crew-title" className="form-label form-label-required">
              크루 이름
            </label>
            <input
              id="crew-title"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 스마트스토어 같이 시작해요"
              className="form-input"
            />
          </div>

          {/* ── 카테고리 ── */}
          <div>
            <p className="form-label form-label-required">카테고리</p>
            <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="카테고리 선택">
              {categories.map((cat) => (
                <button
                  key={cat.name}
                  type="button"
                  onClick={() => handleCategoryChange(cat.name)}
                  aria-pressed={category === cat.name}
                  className={
                    category === cat.name
                      ? "badge-category-active"
                      : "badge-category"
                  }
                >
                  <span aria-hidden="true">{cat.emoji}</span>
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* ── 트랙(방식) ── */}
          <div>
            <p className="form-label form-label-required">운영 방식 (트랙)</p>
            <p className="form-hint mb-3">
              목적에 맞는 운영 방식을 선택하세요 (생성 후 변경 불가)
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <label className={`flex-1 flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors ${track === 'mission' ? 'border-primary bg-primary/5' : 'border-neutral hover:border-primary/50'}`}>
                <input
                  type="radio"
                  name="track"
                  value="mission"
                  checked={track === 'mission'}
                  className="mt-1"
                  onChange={() => setTrack('mission')}
                />
                <div>
                  <p className={`font-bold ${track === 'mission' ? 'text-primary' : 'text-foreground'}`}>🔥 미션 달성형</p>
                  <p className="mt-1 text-sm text-foreground-muted">보증금을 걸고 미션을 수행하며, 달성률에 따라 보상을 나눕니다. 습관 형성과 목표 달성에 좋습니다.</p>
                </div>
              </label>

              <label className={`flex-1 flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors ${track === 'revenue_share' ? 'border-primary bg-primary/5' : 'border-neutral hover:border-primary/50'}`}>
                <input
                  type="radio"
                  name="track"
                  value="revenue_share"
                  checked={track === 'revenue_share'}
                  className="mt-1"
                  onChange={() => setTrack('revenue_share')}
                />
                <div>
                  <p className={`font-bold ${track === 'revenue_share' ? 'text-primary' : 'text-foreground'}`}>💰 수익 분배형 (동업)</p>
                  <p className="mt-1 text-sm text-foreground-muted">실제 수익을 창출하고, 매일 투명 장부를 통해 정산합니다. 팀 프로젝트나 동업에 적합합니다.</p>
                </div>
              </label>
            </div>
          </div>

          {/* ── 역할군 ── */}
          <div>
            <p className="form-label form-label-required">모집 역할군</p>
            <p className="form-hint mb-3">
              A형(투자자): 자본 투자 중심 / B형(실행자): 시간·노하우 투자 중심
            </p>
            <div className="flex flex-wrap gap-2" role="group" aria-label="역할군 선택">
              {ROLE_OPTIONS.map((role) => (
                <button
                  key={role.value}
                  type="button"
                  onClick={() => setRoleType(role.value)}
                  aria-pressed={roleType === role.value}
                  className={`rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${roleType === role.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-neutral bg-transparent text-foreground-muted hover:border-primary/50 hover:text-foreground"
                    }`}
                >
                  {role.label}
                  <span className="ml-1.5 text-xs opacity-70">{role.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ── 크루 소개 ── */}
          <div>
            <label htmlFor="crew-desc" className="form-label form-label-required">
              크루 소개
            </label>
            <textarea
              id="crew-desc"
              required
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="크루의 목표와 활동 방식을 소개해주세요"
              className="form-input resize-none"
            />
          </div>

          {/* ── 최대 인원 ── */}
          <div>
            <label htmlFor="max-members" className="form-label">최대 인원</label>
            <select
              id="max-members"
              value={maxMembers}
              onChange={(e) => setMaxMembers(Number(e.target.value))}
              className="form-input w-auto min-w-[120px]"
            >
              {[3, 4, 5, 6, 8, 10, 15, 20].map((n) => (
                <option key={n} value={n}>{n}명</option>
              ))}
            </select>
          </div>

          {/* ── 활동 기간 (NEW) ── */}
          <div>
            <label htmlFor="activity-period" className="form-label form-label-required">활동 기간</label>
            <p className="form-hint mb-3">크루 활동이 종료되는 시점을 설정합니다. (종료 시 미수행 미션금 정산)</p>
            <select
              id="activity-period"
              value={activityPeriodDays}
              onChange={(e) => setActivityPeriodDays(Number(e.target.value))}
              className="form-input w-auto min-w-[120px]"
            >
              <option value={3}>3일 (테스트/단기)</option>
              <option value={7}>7일 (1주)</option>
              <option value={14}>14일 (2주)</option>
              <option value={30}>30일 (약 1달)</option>
              <option value={60}>60일 (2달)</option>
              <option value={90}>90일 (3달)</option>
            </select>
          </div>

          {/* ── 태그 ── */}
          <div>
            <label className="form-label">태그 <span className="text-xs text-foreground-muted font-normal">(최대 5개)</span></label>
            <div className="flex gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTag();
                  }
                }}
                placeholder="태그 입력 후 Enter"
                className="form-input flex-1"
                aria-label="태그 입력"
              />
              <button
                type="button"
                onClick={addTag}
                className="btn-outline !py-3 !px-4 !rounded-xl"
                disabled={tags.length >= 5}
              >
                추가
              </button>
            </div>
            {tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="flex items-center gap-1 rounded-full border border-neutral bg-surface px-3 py-1 text-sm text-foreground"
                  >
                    #{tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full text-foreground-muted hover:bg-primary/10 hover:text-primary"
                      aria-label={`${tag} 태그 삭제`}
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* ── 가입 수수료 및 포인트 ── */}
          <div className="rounded-2xl border border-neutral bg-surface p-6">
            <h3 className="text-lg font-bold text-foreground">
              {track === 'mission' ? '포인트 설계' : '가입 수수료 및 운영'}
            </h3>
            
            <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between rounded-xl bg-neutral/10 p-4">
              <div>
                <p className="text-sm font-semibold text-foreground">플랫폼 가입비 (자동 계산)</p>
                <p className="text-xs text-foreground-muted mt-1">인원수에 따라 시스템이 자동 부과합니다.</p>
              </div>
              <p className="mt-2 sm:mt-0 text-lg font-bold text-primary">
                인당 {entryPoints.toLocaleString()} P
                <span className="ml-2 text-xs font-normal text-foreground-muted bg-white px-2 py-0.5 rounded-md border">
                  {maxMembers < 6 ? '6인 미만' : '6인 이상'}
                </span>
              </p>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <label htmlFor="crew-deposit" className="form-label font-semibold">크루원 예치금 (선택)</label>
                <p className="form-hint mb-2">크루 가입 시 멤버가 추가로 예치할 금액입니다. (수익형/미션형 공통)</p>
                <div className="flex items-center gap-2">
                  <input
                    id="crew-deposit"
                    type="number"
                    min={0}
                    step={1000}
                    value={deposit}
                    onChange={(e) => setDeposit(Number(e.target.value))}
                    className="form-input w-full sm:w-48"
                    placeholder="0"
                  />
                  <span className="text-sm font-medium text-foreground-muted text-nowrap">P (예치금)</span>
                </div>
              </div>

              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm font-bold text-primary">크루장 보호 예치금</p>
                    <p className="text-xs text-foreground-muted mt-1">해산 시 멤버 보호를 위해 크루장이 선입금합니다.</p>
                  </div>
                  <p className="text-lg font-bold text-primary">{leaderFeeDeposit.toLocaleString()} P</p>
                </div>
                <p className="mt-2 text-[11px] text-primary/70">계산식: 최대 {maxMembers}명 × 플랫폼 참여금({entryPoints.toLocaleString()}P)</p>
              </div>
            </div>

            {track === 'mission' && (
              <div className="mt-5 space-y-4">
                <p className="text-sm text-foreground-muted">미션 달성 시 분배할 수익 비율을 설정하세요 (플랫폼 수수료는 가입 시 정액 부과되므로 배분율 총합은 100%입니다)</p>
                <div>
                  <label className="form-label">크루장 마진율</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={leaderMarginRate}
                      onChange={(e) => handleLeaderMarginChange(Number(e.target.value))}
                      className="flex-1 accent-primary"
                    />
                    <span className="w-14 text-right text-sm font-semibold text-primary">{leaderMarginRate}%</span>
                  </div>
                </div>

                <div>
                  <label className="form-label">크루원 리워드 배분율</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={missionRewardRate}
                      onChange={(e) => handleMissionRewardChange(Number(e.target.value))}
                      className="flex-1 accent-success-text"
                    />
                    <span className="w-14 text-right text-sm font-semibold text-success-text">{missionRewardRate}%</span>
                  </div>
                </div>

                {/* 배분 요약 */}
                <div className={`rounded-xl border p-4 ${isRateValid ? 'border-neutral bg-white' : 'border-primary bg-primary/5'}`}>
                  <p className="text-sm font-medium text-foreground mb-2">배분 구조 요약</p>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-foreground-muted">플랫폼 수수료</span>
                      <span className="font-medium text-foreground-muted">가입 시 고정 부과</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-foreground-muted">크루장 마진</span>
                      <span className="font-medium text-primary">{leaderMarginRate}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-foreground-muted">크루원 리워드 풀</span>
                      <span className="font-medium text-success-text">{missionRewardRate}%</span>
                    </div>
                    <div className="border-t border-neutral pt-1.5 flex justify-between">
                      <span className="font-medium text-foreground">배분 합계</span>
                      <span className={`font-bold ${isRateValid ? 'text-foreground' : 'text-primary'}`}>
                        {leaderMarginRate + missionRewardRate}%
                      </span>
                    </div>
                  </div>
                  {!isRateValid && (
                    <p className="mt-2 text-xs text-primary font-medium">
                      배분율의 합은 정확히 100%여야 합니다.
                    </p>
                  )}
                </div>
              </div>
            )}
            
            {track === 'revenue_share' && (
              <div className="mt-5 space-y-4">
                <p className="text-sm text-foreground-muted">크루장과 크루원 간 수익 분배 비율을 설정하세요. 이 비율은 <strong className="text-primary">생성 후 변경할 수 없으며</strong>, 가입 전 크루원에게 공개됩니다.</p>
                <div>
                  <label className="form-label">크루장 수익 분배율</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={0}
                      max={80}
                      value={leaderMarginRate}
                      onChange={(e) => handleLeaderMarginChange(Number(e.target.value))}
                      className="flex-1 accent-primary"
                    />
                    <span className="w-14 text-right text-sm font-semibold text-primary">{leaderMarginRate}%</span>
                  </div>
                </div>

                <div>
                  <label className="form-label">크루원 수익 분배율 (균등 배분)</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={20}
                      max={100}
                      value={missionRewardRate}
                      onChange={(e) => handleMissionRewardChange(Number(e.target.value))}
                      className="flex-1 accent-success-text"
                    />
                    <span className="w-14 text-right text-sm font-semibold text-success-text">{missionRewardRate}%</span>
                  </div>
                </div>

                {/* 배분 요약 */}
                <div className="rounded-xl border border-neutral bg-white p-4">
                  <p className="text-sm font-medium text-foreground mb-2">수익 분배 구조</p>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-foreground-muted">크루장 몫</span>
                      <span className="font-medium text-primary">{leaderMarginRate}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-foreground-muted">크루원 몫 (균등 배분)</span>
                      <span className="font-medium text-success-text">{missionRewardRate}%</span>
                    </div>
                    <div className="border-t border-neutral pt-1.5 flex justify-between">
                      <span className="font-medium text-foreground">합계</span>
                      <span className="font-bold text-foreground">100%</span>
                    </div>
                    <p className="text-xs text-foreground-muted pt-1">
                      예시: 순수익 100만원 발생 시 → 크루장 {(100 * leaderMarginRate / 100).toFixed(0)}만원, 크루원 1인당 {maxMembers > 1 ? (100 * missionRewardRate / 100 / (maxMembers - 1)).toFixed(1) : 0}만원 (크루원 {maxMembers - 1}명 기준)
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-primary bg-primary/5 p-4">
                  <p className="text-sm font-bold text-primary mb-2">투명 장부 운영 의무</p>
                  <p className="text-sm text-foreground mb-4">
                    수익 분배형은 <strong>매일 크루장이 매출과 지출을 장부에 기록</strong>하고, 크루 전원의 동의를 얻어야 합니다. 확정된 장부를 기준으로 위 비율에 따라 수익을 분배합니다.
                  </p>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={agreeLedger}
                      onChange={(e) => setAgreeLedger(e.target.checked)}
                      className="mt-1"
                    />
                    <span className="text-sm font-medium text-foreground">
                      네, 크루장으로서 장부를 성실히 작성하고 투명하게 공개할 것에 동의합니다.
                    </span>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* ── 미션 (미션형 전용) ── */}
          {track === 'mission' && (
            <div>
              <label className="form-label form-label-required">미션 목록</label>
              <p className="form-hint mb-1">
                카테고리 선택 시 추천 미션이 자동 입력됩니다. 자유롭게 수정하세요.
              </p>
              <p className="text-xs text-primary font-medium mb-3">
                생성 후 미션은 수정할 수 없습니다. 신중하게 설정해주세요.
              </p>
              <div className="space-y-3">
                {missions.map((mission, index) => {
                  const pointsPerMission = missions.length > 0 ? Math.floor(deposit / missions.length) : 0;
                  const memberShare = Math.ceil((pointsPerMission * (missionRewardRate / 100)) / 100) * 100;
                  const leaderShare = pointsPerMission - memberShare;

                  return (
                    <div key={index} className="space-y-2">
                      <div className="flex gap-2 items-start">
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface text-sm font-semibold text-foreground-muted border border-neutral mt-0.5">
                          {index + 1}
                        </span>
                        <div className="flex-1">
                          <input
                            type="text"
                            value={mission.title}
                            onChange={(e) => updateMissionTitle(index, e.target.value)}
                            placeholder={`미션 ${index + 1} 제목`}
                            className="form-input"
                            aria-label={`미션 ${index + 1} 제목`}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeMission(index)}
                          className="btn-destructive !py-2.5 mt-0.5"
                          aria-label={`미션 ${index + 1} 삭제`}
                        >
                          삭제
                        </button>
                      </div>
                      {missions.length > 0 && pointsPerMission > 0 && (
                        <div className="ml-13 flex flex-wrap gap-3 text-[11px] font-medium">
                          <span className="flex items-center gap-1 text-success-text bg-success/10 px-2 py-0.5 rounded-md border border-success/20">
                            👤 크루원: {memberShare.toLocaleString()}P
                          </span>
                          <span className="flex items-center gap-1 text-primary bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20">
                            👑 크루장: {leaderShare.toLocaleString()}P
                          </span>
                          <span className="text-foreground-muted py-0.5 italic">
                            (미션 가액: {pointsPerMission.toLocaleString()}P)
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={addMission}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-neutral px-4 py-3 text-sm text-foreground-muted transition-colors hover:border-primary hover:text-primary"
              >
                <span aria-hidden="true">+</span> 미션 추가
              </button>
            </div>
          )}

          {/* ── Submit ── */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={!isRateValid || isSubmitting}
              className="btn-primary btn-primary-lg w-full disabled:opacity-50"
            >
              {isSubmitting ? "생성 중..." : "크루 생성하기"}
            </button>
            <p className="mt-3 text-center text-xs text-foreground-muted">
              크루를 생성하면 이용약관에 동의하는 것으로 간주됩니다.
            </p>
          </div>
        </form>
      </div>

      <Footer />

      {/* Disclaimer Modal */}
      {showDisclaimer && (
        <DisclaimerModal
          consentType="crew_create_disclaimer"
          title="크루 생성 면책 동의"
          onAgree={handleDisclaimerAgree}
          onCancel={() => setShowDisclaimer(false)}
        />
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-xl">
            <h3 className="text-xl font-bold text-foreground">최종 확인</h3>
            <p className="mt-2 text-sm text-foreground-muted">
              이대로 크루를 생성하시겠습니까? <br/> 생성 후 미션 내용 및 배분율은 <strong>수정할 수 없습니다.</strong>
            </p>

            <div className="mt-4 rounded-xl border border-neutral bg-background p-4 text-sm divide-y divide-neutral">
              <div className="flex justify-between pb-2">
                <span className="text-foreground-muted">크루 이름</span>
                <span className="font-semibold text-foreground text-right w-2/3 truncate">{title}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-foreground-muted">트랙 (운영 방식)</span>
                <span className="font-semibold text-foreground text-right">
                  {track === 'mission' ? '🔥 미션 달성형' : '💰 수익 분배형'} ({activityPeriodDays}일 정산)
                </span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-foreground-muted">크루원 개별 예치금</span>
                <span className="font-semibold text-foreground">{deposit.toLocaleString()}P</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-foreground-muted font-bold text-primary">크루장 보호 예치금</span>
                <span className="font-semibold text-primary">{leaderFeeDeposit.toLocaleString()}P</span>
              </div>
              <div className="flex justify-between pt-2">
                <span className="text-foreground-muted">수익 배분율</span>
                <span className="font-semibold text-foreground text-right">
                  크루장 {leaderMarginRate}% / 크루원 {missionRewardRate}%
                </span>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="btn-outline flex-1 !rounded-xl !py-3"
              >
                취소
              </button>
              <button
                type="button"
                onClick={executeSubmit}
                className="btn-primary flex-1 !rounded-xl !py-3"
              >
                생성 확정
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
