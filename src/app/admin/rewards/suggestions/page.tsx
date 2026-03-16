'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

interface Suggestion {
  id: string;
  user_id: string;
  product_name: string;
  reason: string;
  status: 'pending' | 'reviewed' | 'added' | 'rejected';
  admin_memo: string | null;
  created_at: string;
  profiles: {
    nickname: string;
  };
}

export default function RewardSuggestionsAdmin() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    fetchSuggestions();
  }, []);

  const fetchSuggestions = async () => {
    try {
      const { data, error } = await supabase
        .from('reward_suggestions')
        .select('*, profiles(nickname)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSuggestions(data || []);
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id: string, status: Suggestion['status']) => {
    setUpdatingId(id);
    try {
      const { error } = await supabase
        .from('reward_suggestions')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      setSuggestions(prev => prev.map(s => s.id === id ? { ...s, status } : s));
    } catch (err) {
      console.error('Update error:', err);
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading) return <div className="p-8 text-center">로딩 중...</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">리워드 상품 제안 목록</h1>
        <p className="text-foreground-muted mt-1">유저들이 M-Pick 파트너 몰에서 요청한 상품들입니다.</p>
      </div>

      <div className="bg-surface rounded-2xl shadow-sm border border-neutral overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-neutral/5 border-b border-neutral font-medium text-foreground-muted">
            <tr>
              <th className="px-4 py-3">신청일</th>
              <th className="px-4 py-3">유저</th>
              <th className="px-4 py-3">상품명</th>
              <th className="px-4 py-3">제안 이유</th>
              <th className="px-4 py-3">상태</th>
              <th className="px-4 py-3">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral">
            {suggestions.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-foreground-muted italic">
                  아직 제안된 상품이 없습니다.
                </td>
              </tr>
            ) : (
              suggestions.map((s) => (
                <tr key={s.id} className="hover:bg-neutral/2 transition-colors">
                  <td className="px-4 py-4 whitespace-nowrap">
                    {new Date(s.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-4 font-medium">{s.profiles?.nickname || 'Unknown'}</td>
                  <td className="px-4 py-4">
                    <span className="font-medium text-foreground">{s.product_name}</span>
                  </td>
                  <td className="px-4 py-4">
                    <p className="line-clamp-2 text-foreground-muted">{s.reason || '-'}</p>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      s.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                      s.status === 'reviewed' ? 'bg-blue-100 text-blue-700' :
                      s.status === 'added' ? 'bg-green-100 text-green-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {s.status === 'pending' ? '대기 중' :
                       s.status === 'reviewed' ? '검토 완료' :
                       s.status === 'added' ? '스토어 추가' : '반려'}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex gap-1">
                      <select 
                        disabled={updatingId === s.id}
                        value={s.status}
                        onChange={(e) => updateStatus(s.id, e.target.value as any)}
                        className="text-xs bg-neutral/10 border-none rounded-lg px-2 py-1 focus:ring-1 focus:ring-primary"
                      >
                        <option value="pending">대기 중</option>
                        <option value="reviewed">검토 완료</option>
                        <option value="added">스토어 추가</option>
                        <option value="rejected">반려</option>
                      </select>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
