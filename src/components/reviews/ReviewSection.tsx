"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

interface Review {
  id: string;
  reviewer_id: string;
  crew_rating: number;
  leader_rating: number;
  comment: string;
  created_at: string;
  profiles: {
    nickname: string;
    avatar_url: string;
  };
}

export default function ReviewSection({ crewId }: { crewId: string }) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isMember, setIsMember] = useState(false);
  
  // Form state
  const [crewRating, setCrewRating] = useState(5);
  const [leaderRating, setLeaderRating] = useState(5);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/crews/${crewId}/reviews`);
      if (res.ok) {
        const data = await res.json();
        setReviews(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [crewId]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        setCurrentUser(data.user);
        // 멤버십 확인
        supabase.from('crew_members')
          .select('status')
          .eq('crew_id', crewId)
          .eq('user_id', data.user.id)
          .single()
          .then(({ data: member }) => {
             if (member && member.status === 'active') setIsMember(true);
          });
      }
    });

    fetchReviews();
  }, [crewId, fetchReviews]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/crews/${crewId}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          crew_rating: crewRating,
          leader_rating: leaderRating,
          comment
        })
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
      } else {
        setSuccess(true);
        setComment("");
        fetchReviews();
      }
    } catch (e) {
      setError("리뷰 작성 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  const StarRating = ({ value, onChange }: { value: number; onChange?: (v: number) => void }) => (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange?.(star)}
          className={`text-xl ${star <= value ? "text-yellow-400" : "text-neutral/30"}`}
        >
          ★
        </button>
      ))}
    </div>
  );

  return (
    <div className="mt-12 border-t border-neutral pt-8">
      <h3 className="text-xl font-bold text-foreground">크루 리뷰 및 평판</h3>

      {/* 리뷰 작성 폼 (멤버 전용) */}
      {isMember && !success && (
        <form onSubmit={handleSubmit} className="mt-6 rounded-2xl bg-surface border border-neutral p-6 space-y-4 shadow-sm">
          <p className="font-bold text-sm text-foreground mb-2">활동은 어떠셨나요? 리뷰를 남겨주세요!</p>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-foreground-muted mb-1 block">크루 활동 만족도</label>
              <StarRating value={crewRating} onChange={setCrewRating} />
            </div>
            <div>
              <label className="text-xs text-foreground-muted mb-1 block">크루장 리더십/평판</label>
              <StarRating value={leaderRating} onChange={setLeaderRating} />
            </div>
          </div>

          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="다른 지원자들에게 도움이 될 수 있도록 솔직한 후기를 남겨주세요."
            className="w-full rounded-xl border border-neutral bg-background p-3 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
            rows={3}
          />

          {error && <p className="text-xs text-red-500 font-medium">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="btn-primary w-full py-3 text-sm font-bold"
          >
            {submitting ? "제출 중..." : "리뷰 등록하기"}
          </button>
        </form>
      )}

      {success && (
        <div className="mt-6 rounded-2xl bg-green-500/10 border border-green-200 text-green-600 p-4 text-center text-sm font-medium">
          리뷰가 성공적으로 등록되었습니다. 감사합니다!
        </div>
      )}

      {/* 리뷰 목록 */}
      <div className="mt-8 space-y-6">
        {loading ? (
          <p className="text-center text-sm text-foreground-muted py-10">리뷰를 불러오는 중...</p>
        ) : reviews.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral p-10 text-center">
            <p className="text-sm text-foreground-muted">아직 작성된 리뷰가 없습니다.</p>
            <p className="mt-1 text-xs text-foreground-muted">첫 번째 리뷰의 주인공이 되어보세요!</p>
          </div>
        ) : (
          reviews.map((review) => (
            <div key={review.id} className="border-b border-neutral pb-6 last:border-0">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-neutral/10 flex items-center justify-center font-bold text-neutral">
                    {review.profiles.nickname[0]}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">{review.profiles.nickname}</p>
                    <p className="text-[10px] text-foreground-muted">{new Date(review.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-foreground-muted">크루</span>
                    <StarRating value={review.crew_rating} />
                  </div>
                  <div className="flex items-center gap-2 text-xs mt-1">
                    <span className="text-foreground-muted">크루장</span>
                    <StarRating value={review.leader_rating} />
                  </div>
                </div>
              </div>
              <p className="mt-4 text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                {review.comment}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
