'use client';

import { useEffect, useState } from 'react';

interface BlacklistEntry {
  id: string;
  user_id: string;
  reason: string;
  banned_until: string | null;
  report_id: string | null;
  created_at: string;
  profile: { id: string; nickname: string; email: string } | null;
  report: { id: string; title: string; report_type: string } | null;
}

export default function AdminBlacklistPage() {
  const [entries, setEntries] = useState<BlacklistEntry[]>([]);
  const [loading, setLoading] = useState(true);

  function fetchData() {
    setLoading(true);
    fetch('/api/admin/blacklist')
      .then((res) => res.json())
      .then((data: BlacklistEntry[]) => setEntries(data))
      .finally(() => setLoading(false));
  }

  useEffect(fetchData, []);

  async function handleRemove(entryId: string) {
    if (!confirm('이 사용자의 블랙리스트를 해제하시겠습니까?')) return;

    const res = await fetch(`/api/admin/blacklist/${entryId}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      setEntries((prev) => prev.filter((e) => e.id !== entryId));
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">블랙리스트</h1>

      {loading ? (
        <p className="text-foreground-muted text-sm py-8 text-center">
          불러오는 중...
        </p>
      ) : entries.length === 0 ? (
        <div className="empty-state">
          <p className="text-sm">블랙리스트가 비어있습니다.</p>
        </div>
      ) : (
        <div className="card-flat overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral text-left text-foreground-muted">
                <th className="px-4 py-3 font-medium">닉네임</th>
                <th className="px-4 py-3 font-medium">사유</th>
                <th className="px-4 py-3 font-medium">해제일</th>
                <th className="px-4 py-3 font-medium">관련 신고</th>
                <th className="px-4 py-3 font-medium">등록일</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr
                  key={entry.id}
                  className="border-b border-neutral/50"
                >
                  <td className="px-4 py-3 font-medium text-foreground">
                    {entry.profile?.nickname ?? entry.user_id.slice(0, 8)}
                  </td>
                  <td className="px-4 py-3 text-foreground-muted max-w-[240px] truncate">
                    {entry.reason}
                  </td>
                  <td className="px-4 py-3 text-foreground-muted">
                    {entry.banned_until
                      ? new Date(entry.banned_until).toLocaleDateString('ko-KR')
                      : '영구'}
                  </td>
                  <td className="px-4 py-3 text-foreground-muted text-xs">
                    {entry.report ? entry.report.title : '-'}
                  </td>
                  <td className="px-4 py-3 text-foreground-muted">
                    {new Date(entry.created_at).toLocaleDateString('ko-KR')}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleRemove(entry.id)}
                      className="btn-destructive px-3 py-1 text-xs"
                    >
                      해제
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
