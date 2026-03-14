"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { User } from '@supabase/supabase-js';
import DisclaimerModal from '@/components/DisclaimerModal';

export default function JoinCrewButton({ crewId }: { crewId: string }) {
    const router = useRouter();
    const [isJoining, setIsJoining] = useState(false);
    const [user, setUser] = useState<User | null>(null);
    const [membershipStatus, setMembershipStatus] = useState<'none' | 'pending' | 'active' | 'owner' | 'loading' | 'left' | 'rejected'>('loading');
    const [showDisclaimer, setShowDisclaimer] = useState(false);

    useEffect(() => {
        const checkStatus = async () => {
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
            setUser(user);

            if (!user) {
                setMembershipStatus('none');
                return;
            }

            // Check if user is the owner
            const { data: crew } = await supabase
                .from('crews')
                .select('created_by')
                .eq('id', crewId)
                .single();
            
            if (crew?.created_by === user.id) {
                setMembershipStatus('owner');
                return;
            }

            // Check membership
            const { data: member } = await supabase
                .from('crew_members')
                .select('status')
                .eq('crew_id', crewId)
                .eq('user_id', user.id)
                .single();

            if (member) {
                setMembershipStatus(member.status as any);
            } else {
                setMembershipStatus('none');
            }
        };

        checkStatus();
    }, [crewId]);

    const handleJoinClick = () => {
        if (!user) {
            router.push('/login');
            return;
        }
        if (isJoining || membershipStatus !== 'none') return;
        setShowDisclaimer(true);
    };

    const handleJoin = async () => {
        setShowDisclaimer(false);
        if (!user) return;
        if (isJoining || membershipStatus !== 'none') return;
        setIsJoining(true);

        try {
            const res = await fetch(`/api/crews/${crewId}/join`, {
                method: 'POST',
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || '참여 신청에 실패했습니다.');
            }

            alert('크루 참여 신청이 완료되었습니다!');
            setMembershipStatus('pending');
            router.refresh();

        } catch (error: any) {
            alert(error.message);
        } finally {
            setIsJoining(false);
        }
    };

    const handleLeave = async () => {
        if (!confirm("정말 크루를 탈퇴하시겠습니까?\n자발적 탈퇴 시 이미 예치된 에스크로 포인트는 전액 몰수되며 환급되지 않습니다.")) return;
        
        setIsJoining(true); // Re-use loading state
        try {
            const res = await fetch(`/api/crews/${crewId}/leave`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ confirm: true })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || '크루 탈퇴에 실패했습니다.');
            }

            alert('크루에서 성공적으로 탈퇴했습니다.');
            setMembershipStatus('left');
            router.refresh();

        } catch (error: any) {
            alert(error.message);
        } finally {
            setIsJoining(false);
        }
    };

    if (membershipStatus === 'loading') {
        return <div className="animate-pulse bg-neutral/20 h-14 rounded-xl flex-1" />;
    }

    if (membershipStatus === 'owner') {
        return (
            <Link 
                href={`/crews/${crewId}/dashboard`}
                className="btn-outline btn-primary-lg flex-1 flex items-center justify-center"
            >
                관리 대시보드
            </Link>
        );
    }

    const buttonText = {
        none: user ? "크루 참여 신청하기" : "로그인하고 참여하기",
        pending: "승인 대기 중",
        active: "이미 참여 중",
        rejected: "참여 거절됨",
        left: "탈퇴한 크루입니다",
    }[membershipStatus as 'none' | 'pending' | 'active' | 'rejected' | 'left'] || "참여 불가";

    // When status is active, render a green badge/disabled button and a Leave button side-by-side
    if (membershipStatus === 'active') {
        return (
            <div className="flex flex-1 gap-2">
                <button
                    disabled
                    className="btn-primary btn-primary-lg flex-1 !bg-success-text !border-success-text opacity-100 cursor-default"
                >
                    이미 참여 중인 크루입니다
                </button>
                <button
                    onClick={handleLeave}
                    disabled={isJoining}
                    className="btn-outline btn-primary-lg !border-primary !text-primary hover:!bg-primary hover:!text-white whitespace-nowrap px-6"
                >
                    {isJoining ? "처리 중..." : "크루 탈퇴"}
                </button>
            </div>
        );
    }

    const isDisabled = isJoining || membershipStatus !== 'none';

    return (
        <>
            <button
                onClick={handleJoinClick}
                disabled={isDisabled}
                className="btn-primary btn-primary-lg flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {isJoining ? "처리 중..." : buttonText}
            </button>
            {showDisclaimer && (
                <DisclaimerModal
                    consentType="crew_join_disclaimer"
                    crewId={crewId}
                    title="크루 참여 면책 동의"
                    onAgree={handleJoin}
                    onCancel={() => setShowDisclaimer(false)}
                />
            )}
        </>
    );
}
