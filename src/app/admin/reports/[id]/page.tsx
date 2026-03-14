'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

const REPORT_TYPE_LABEL: Record<string, string> = {
  revenue_hiding: '매출 은닉',
  payment_default: '정산 미이행',
  unauthorized_expense: '독단적 지출',
  fraud: '사기',
  harassment: '괴롭힘',
  other: '기타',
};

const STATUS_OPTIONS = [
  { value: 'pending', label: '대기중' },
  { value: 'reviewing', label: '검토중' },
  { value: 'resolved', label: '처리완료' },
  { value: 'dismissed', label: '기각' },
];

interface ReportDetail {
  id: string;
  title: string;
  description: string;
  report_type: string;
  status: string;
  admin_note: string | null;
  created_at: string;
  resolved_at: string | null;
  reporter_id: string;
  target_user_id: string | null;
  crew_id: string | null;
  reporter: { id: string; nickname: string; email: string } | null;
  target: { id: string; nickname: string; email: string } | null;
  crew: { id: string; title: string } | null;
}

export default function AdminReportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [report, setReport] = useState<ReportDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');
  const [adminNote, setAdminNote] = useState('');
  const [isTargetBlacklisted, setIsTargetBlacklisted] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/reports/${id}`)
      .then((res) => res.json())
      .then((data: ReportDetail) => {
        setReport(data);
        setStatus(data.status);
        setAdminNote(data.admin_note ?? '');
      })
      .finally(() => setLoading(false));
  }, [id]);

  // Check blacklist status for target user
  useEffect(() => {
    if (!report?.target_user_id) return;
    fetch('/api/admin/blacklist')
      .then((res) => res.json())
      .then((entries: { user_id: string }[]) => {
        setIsTargetBlacklisted(
          entries.some((e) => e.user_id === report.target_user_id)
        );
      });
  }, [report?.target_user_id]);

  async function handleSave() {
    setSaving(true);
    const res = await fetch(`/api/admin/reports/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, adminNote }),
    });
    if (res.ok) {
      const updated = await res.json();
      setReport((prev) => (prev ? { ...prev, ...updated } : prev));
    }
    setSaving(false);
  }

  async function handleBlacklist() {
    if (!report?.target_user_id) return;
    if (!confirm('이 사용자를 블랙리스트에 추가하시겠습니까?')) return;

    const res = await fetch('/api/admin/blacklist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: report.target_user_id,
        reason: `신고 #${report.id}: ${report.title}`,
        reportId: report.id,
      }),
    });
    if (res.ok) {
      setIsTargetBlacklisted(true);
    }
  }

  if (loading) {
    return (
      <p className="text-foreground-muted text-sm py-8 text-center">
        불러오는 중...
      </p>
    );
  }

  if (!report) {
    return (
      <p className="text-foreground-muted text-sm py-8 text-center">
        신고를 찾을 수 없습니다.
      </p>
    );
  }

  return (
    <div className="max-w-3xl">
      <button
        onClick={() => router.push('/admin/reports')}
        className="text-sm text-foreground-muted hover:text-primary mb-4 inline-block"
      >
        &larr; 신고 목록
      </button>

      <h1 className="text-2xl font-bold text-foreground mb-6">{report.title}</h1>

      {/* Report info */}
      <div className="card-flat mb-4 space-y-3">
        <div className="flex flex-wrap gap-4 text-sm">
          <div>
            <span className="text-foreground-muted">유형: </span>
            <span className="tag-chip">
              {REPORT_TYPE_LABEL[report.report_type] ?? report.report_type}
            </span>
          </div>
          <div>
            <span className="text-foreground-muted">접수일: </span>
            {new Date(report.created_at).toLocaleString('ko-KR')}
          </div>
          {report.resolved_at && (
            <div>
              <span className="text-foreground-muted">처리일: </span>
              {new Date(report.resolved_at).toLocaleString('ko-KR')}
            </div>
          )}
          {report.crew && (
            <div>
              <span className="text-foreground-muted">크루: </span>
              {report.crew.title}
            </div>
          )}
        </div>

        <div className="pt-2 border-t border-neutral/50">
          <p className="text-sm whitespace-pre-wrap text-foreground">
            {report.description}
          </p>
        </div>
      </div>

      {/* Reporter & Target */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="card-flat">
          <p className="text-xs text-foreground-muted mb-1">신고자</p>
          <p className="text-sm font-medium">
            {report.reporter?.nickname ?? '-'}
          </p>
          <p className="text-xs text-foreground-muted">
            {report.reporter?.email ?? ''}
          </p>
        </div>
        <div className="card-flat">
          <p className="text-xs text-foreground-muted mb-1">대상 사용자</p>
          <p className="text-sm font-medium">
            {report.target?.nickname ?? '-'}
          </p>
          <p className="text-xs text-foreground-muted">
            {report.target?.email ?? ''}
          </p>
        </div>
      </div>

      {/* Status + Admin note */}
      <div className="card-flat space-y-4 mb-4">
        <div>
          <label className="form-label">상태 변경</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="form-input"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="form-label">관리자 메모</label>
          <textarea
            value={adminNote}
            onChange={(e) => setAdminNote(e.target.value)}
            rows={4}
            className="form-input"
            placeholder="처리 내용을 기록하세요..."
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary"
          >
            {saving ? '저장 중...' : '저장'}
          </button>

          {report.target_user_id && !isTargetBlacklisted && (
            <button onClick={handleBlacklist} className="btn-destructive">
              블랙리스트 추가
            </button>
          )}

          {isTargetBlacklisted && (
            <span className="badge-locked self-center">블랙리스트 등록됨</span>
          )}
        </div>
      </div>
    </div>
  );
}
