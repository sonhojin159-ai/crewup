import { signInWithOAuth } from '@/app/auth/actions';

export function OAuthButtons() {
    return (
        <div className="mt-6 space-y-3">
            <form action={signInWithOAuth.bind(null, 'kakao')}>
                <button
                    type="submit"
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-neutral py-3 text-sm font-medium text-foreground transition-colors hover:border-[#FEE500] hover:bg-[#FEE500]/5"
                >
                    <span className="flex h-5 w-5 items-center justify-center rounded-sm bg-[#FEE500] text-[10px] font-bold text-[#3C1E1E]">K</span>
                    카카오로 시작하기
                </button>
            </form>
            <form action={signInWithOAuth.bind(null, 'google')}>
                <button
                    type="submit"
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-neutral py-3 text-sm font-medium text-foreground transition-colors hover:border-blue-500 hover:bg-surface"
                >
                    <span className="text-lg" aria-hidden="true">🔵</span>
                    구글로 시작하기
                </button>
            </form>
        </div>
    );
}
