'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

interface User {
  id: string;
  nickname: string;
  email: string;
  created_at: string;
}

interface UsersResponse {
  data: User[];
  total: number;
}

const PAGE_SIZE = 20;

function maskEmail(email: string): string {
  const [local] = email.split('@');
  if (!local) return '***';
  return local.slice(0, 3) + '***';
}

export default function AdminUsersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentSearch = searchParams.get('search') ?? '';
  const currentPage = Number(searchParams.get('page') ?? '1');

  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState(currentSearch);

  useEffect(() => {
    const params = new URLSearchParams();
    if (currentSearch) params.set('search', currentSearch);
    params.set('page', String(currentPage));

    fetch(`/api/admin/users?${params}`)
      .then((res) => res.json())
      .then((json: UsersResponse) => {
        setUsers(json.data ?? []);
        setTotal(json.total ?? 0);
      })
      .finally(() => setLoading(false));
  }, [currentSearch, currentPage]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const params = new URLSearchParams();
    if (searchInput.trim()) params.set('search', searchInput.trim());
    router.push(`/admin/users?${params}`);
  }

  function navigate(page: number) {
    setLoading(true);
    const params = new URLSearchParams();
    if (currentSearch) params.set('search', currentSearch);
    if (page > 1) params.set('page', String(page));
    router.push(`/admin/users?${params}`);
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">사용자 관리</h1>

      <form onSubmit={handleSearch} className="flex gap-2 mb-6 max-w-md">
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="닉네임 검색..."
          className="form-input"
        />
        <button type="submit" className="btn-outline shrink-0">
          검색
        </button>
      </form>

      {loading ? (
        <p className="text-foreground-muted text-sm py-8 text-center">
          불러오는 중...
        </p>
      ) : users.length === 0 ? (
        <div className="empty-state">
          <p className="text-sm">사용자가 없습니다.</p>
        </div>
      ) : (
        <>
          <div className="card-flat overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral text-left text-foreground-muted">
                  <th className="px-4 py-3 font-medium">닉네임</th>
                  <th className="px-4 py-3 font-medium">이메일</th>
                  <th className="px-4 py-3 font-medium">가입일</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr
                    key={u.id}
                    onClick={() => router.push(`/admin/users/${u.id}`)}
                    className="border-b border-neutral/50 hover:bg-neutral/10 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-foreground">
                      {u.nickname}
                    </td>
                    <td className="px-4 py-3 text-foreground-muted">
                      {maskEmail(u.email)}
                    </td>
                    <td className="px-4 py-3 text-foreground-muted">
                      {new Date(u.created_at).toLocaleDateString('ko-KR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button
                onClick={() => navigate(currentPage - 1)}
                disabled={currentPage <= 1}
                className="btn-outline px-3 py-1.5 text-sm disabled:opacity-40"
              >
                이전
              </button>
              <span className="text-sm text-foreground-muted">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => navigate(currentPage + 1)}
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
