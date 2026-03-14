'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

interface Membership {
  crew_id: string;
  role: string;
  status: string;
  created_at: string;
  crew: { id: string; title: string; category: string; status: string } | null;
}

interface Report {
  id: string;
  title: string;
  report_type: string;
  status: string;
  created_at: string;
}

interface BlacklistEntry {
  id: string;
  reason: string;
  banned_until: string | null;
  created_at: string;
}

interface Profile {
  id: string;
  nickname: string;
  email: string;
  role: string | null;
  created_at: string;
}

interface UserDetailResponse {
  profile: Profile;
  memberships: Membership[];
  reports: Report[];
  blacklist: BlacklistEntry | null;
}

const REPORT_TYPE_LABEL: Record<string, string> = {
  revenue_hiding: '매출 은닉',
  payment_default: '정산 미이행',
  unauthorized_expense: '독단적 지출',
  fraud: '사기',
  harassment: '괴롭힘',
  other: '기타',
};

export default function AdminUserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [data, setData] = useState<UserDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/admin/users/${id}`)
      .then((res) => res.json())
      .then((json: UserDetailResponse) => setData(json))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleBlacklistToggle() {
    if (!data) return;

    if (data.blacklist) {
      if (!confirm('블랙리스트를 해제하시겠습니까?')) return;
      const res = await fetch(`/api/admin/blacklist/${data.blacklist.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setData((prev) => (prev ? { ...prev, blacklist: null } : prev));
      }
    } else {
      const reason = prompt('블랙리스트 사유를 입력하세요:');
      if (!reason?.trim()) return;
      const res = await fetch('/api/admin/blacklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: data.profile.id,
          reason: reason.trim(),
        }),
      });
      if (res.ok) {
        const entry = await res.json();
        setData((prev) => (prev ? { ...prev, blacklist: entry } : prev));
      }
    }
  }

  if (loading) {
    return (
      <p className="text-foreground-muted text-sm py-8 text-center">
        불러오는 중...
      </p>
    );
  }

  if (!data) {
    return (
      <p className="text-foreground-muted text-sm py-8 text-center">
        사용자를 찾을 수 없습니다.
      </p>
    );
  }

  const { profile, memberships, reports, blacklist } = data;

  return (
    <div className="max-w-3xl">
      <button
        onClick={() => router.push('/admin/users')}
        className="text-sm text-foreground-muted hover:text-primary mb-4 inline-block"
      >
        &larr; 사용자 목록
      </button>

      {/* Profile card */}
      <div className="card-flat mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">
              {profile.nickname}
            </h1>
            <p className="text-sm text-foreground-muted mt-1">
              {profile.email}
            </p>
            <div className="flex gap-4 mt-2 text-xs text-foreground-muted">
              {profile.role && <span>역할: {profile.role}</span>}
              <span>
                가입일:{' '}
                {new Date(profile.created_at).toLocaleDateString('ko-KR')}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {blacklist && <span className="badge-locked">블랙리스트</span>}
            <button
              onClick={handleBlacklistToggle}
              className={
                blacklist ? 'btn-outline text-sm' : 'btn-destructive text-sm'
              }
            >
              {blacklist ? '블랙리스트 해제' : '블랙리스트 추가'}
            </button>
          </div>
        </div>

        {blacklist && (
          <div className="mt-3 p-3 rounded-lg bg-neutral/10 text-sm">
            <p className="text-foreground-muted">사유: {blacklist.reason}</p>
            <p className="text-foreground-muted">
              해제일:{' '}
              {blacklist.banned_until
                ? new Date(blacklist.banned_until).toLocaleDateString('ko-KR')
                : '영구'}
            </p>
          </div>
        )}
      </div>

      {/* Crew memberships */}
      <section className="mb-6">
        <h2 className="text-lg font-bold text-foreground mb-3">
          크루 참여 현황
        </h2>
        {memberships.length === 0 ? (
          <p className="text-sm text-foreground-muted">
            참여 중인 크루가 없습니다.
          </p>
        ) : (
          <div className="card-flat overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral text-left text-foreground-muted">
                  <th className="px-4 py-2 font-medium">크루</th>
                  <th className="px-4 py-2 font-medium">역할</th>
                  <th className="px-4 py-2 font-medium">상태</th>
                  <th className="px-4 py-2 font-medium">참여일</th>
                </tr>
              </thead>
              <tbody>
                {memberships.map((m) => (
                  <tr
                    key={m.crew_id}
                    className="border-b border-neutral/50"
                  >
                    <td className="px-4 py-2 font-medium text-foreground">
                      {m.crew?.title ?? m.crew_id.slice(0, 8)}
                    </td>
                    <td className="px-4 py-2 text-foreground-muted">
                      {m.role}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={
                          m.status === 'active'
                            ? 'badge-success'
                            : 'badge-locked'
                        }
                      >
                        {m.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-foreground-muted">
                      {new Date(m.created_at).toLocaleDateString('ko-KR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Reports against this user */}
      <section>
        <h2 className="text-lg font-bold text-foreground mb-3">
          관련 신고 내역
        </h2>
        {reports.length === 0 ? (
          <p className="text-sm text-foreground-muted">
            신고 내역이 없습니다.
          </p>
        ) : (
          <div className="card-flat overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral text-left text-foreground-muted">
                  <th className="px-4 py-2 font-medium">제목</th>
                  <th className="px-4 py-2 font-medium">유형</th>
                  <th className="px-4 py-2 font-medium">상태</th>
                  <th className="px-4 py-2 font-medium">접수일</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => router.push(`/admin/reports/${r.id}`)}
                    className="border-b border-neutral/50 hover:bg-neutral/10 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-2 font-medium text-foreground">
                      {r.title}
                    </td>
                    <td className="px-4 py-2">
                      <span className="tag-chip">
                        {REPORT_TYPE_LABEL[r.report_type] ?? r.report_type}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-foreground-muted">
                      {r.status}
                    </td>
                    <td className="px-4 py-2 text-foreground-muted">
                      {new Date(r.created_at).toLocaleDateString('ko-KR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
