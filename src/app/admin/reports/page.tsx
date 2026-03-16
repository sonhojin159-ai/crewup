'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

const STATUS_TABS = [
  { key: '', label: '전체' },
  { key: 'pending', label: '대기중' },
  { key: 'reviewing', label: '검토중' },
  { key: 'resolved', label: '처리완료' },
  { key: 'dismissed', label: '기각' },
] as const;

const REPORT_TYPE_LABEL: Record<string, string> = {
  revenue_hiding: '매출 은닉',
  payment_default: '정산 미이행',
  unauthorized_expense: '독단적 지출',
  fraud: '사기',
  harassment: '괴롭힘',
  other: '기타',
};

const STATUS_BADGE_CLASS: Record<string, string> = {
  pending:
    'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 border border-amber-300',
  reviewing:
    'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 border border-blue-300',
  resolved:
    'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-green-100 text-green-800 border border-green-300',
  dismissed:
    'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 border border-gray-300',
};

const STATUS_LABEL: Record<string, string> = {
  pending: '대기중',
  reviewing: '검토중',
  resolved: '처리완료',
  dismissed: '기각',
};

interface Report {
  id: string;
  title: string;
  report_type: string;
  status: string;
  created_at: string;
  reporter: { id: string; nickname: string } | null;
  target: { id: string; nickname: string } | null;
}

interface ReportsResponse {
  data: Report[];
  total: number;
}

const PAGE_SIZE = 20;

export default function AdminReportsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentStatus = searchParams.get('status') ?? '';
  const currentPage = Number(searchParams.get('page') ?? '1');

  const [reports, setReports] = useState<Report[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams();
    if (currentStatus) params.set('status', currentStatus);
    params.set('page', String(currentPage));

    fetch(`/api/admin/reports?${params}`)
      .then((res) => res.json())
      .then((json: ReportsResponse) => {
        setReports(json.data ?? []);
        setTotal(json.total ?? 0);
      })
      .finally(() => setLoading(false));
  }, [currentStatus, currentPage]);

  function navigate(status: string, page: number) {
    setLoading(true);
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (page > 1) params.set('page', String(page));
    router.push(`/admin/reports?${params}`);
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">신고 관리</h1>

      {/* Status tabs */}
      <div className="flex gap-1 border-b border-neutral mb-6">
        {STATUS_TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => navigate(key, 1)}
            className={`tab-btn ${currentStatus === key ? 'tab-btn-active' : ''}`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-foreground-muted text-sm py-8 text-center">
          불러오는 중...
        </p>
      ) : reports.length === 0 ? (
        <div className="empty-state">
          <p className="text-sm">신고 내역이 없습니다.</p>
        </div>
      ) : (
        <>
          <div className="card-flat overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral text-left text-foreground-muted">
                  <th className="px-4 py-3 font-medium">제목</th>
                  <th className="px-4 py-3 font-medium">유형</th>
                  <th className="px-4 py-3 font-medium">신고자</th>
                  <th className="px-4 py-3 font-medium">대상</th>
                  <th className="px-4 py-3 font-medium">상태</th>
                  <th className="px-4 py-3 font-medium">접수일</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => router.push(`/admin/reports/${r.id}`)}
                    className="border-b border-neutral/50 hover:bg-neutral/10 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-foreground max-w-[200px] truncate">
                      {r.title}
                    </td>
                    <td className="px-4 py-3">
                      <span className="tag-chip">
                        {REPORT_TYPE_LABEL[r.report_type] ?? r.report_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-foreground-muted">
                      {r.reporter?.nickname ?? '-'}
                    </td>
                    <td className="px-4 py-3 text-foreground-muted">
                      {r.target?.nickname ?? '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={STATUS_BADGE_CLASS[r.status] ?? ''}>
                        {STATUS_LABEL[r.status] ?? r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-foreground-muted">
                      {new Date(r.created_at).toLocaleDateString('ko-KR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button
                onClick={() => navigate(currentStatus, currentPage - 1)}
                disabled={currentPage <= 1}
                className="btn-outline px-3 py-1.5 text-sm disabled:opacity-40"
              >
                이전
              </button>
              <span className="text-sm text-foreground-muted">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => navigate(currentStatus, currentPage + 1)}
                disabled={currentPage >= totalPages}
                className="btn-outline px-3 py-1.5 text-sm disabled:opacity-40"
              >
                다음
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
