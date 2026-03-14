'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';

export async function login(formData: FormData) {
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    try {
        const supabase = await createClient();

        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            console.error('Login error:', error.message);
            let userMessage = '이메일 또는 비밀번호가 올바르지 않거나 잘못된 형식입니다.';
            if (error.message.includes('Email not confirmed')) {
                userMessage = '이메일 인증이 완료되지 않았습니다. 메일함을 확인해 주세요.';
            } else if (error.message.includes('rate limit exceeded')) {
                userMessage = '너무 많은 로그인 시도가 있었습니다. 잠시 후 다시 시도해 주세요.';
            }
            redirect(`/login?error=${encodeURIComponent(userMessage)}`);
        }
    } catch (error: any) {
        if (error.digest?.startsWith('NEXT_REDIRECT')) {
            throw error;
        }
        console.error('Unexpected login error:', error);
        redirect(`/login?error=${encodeURIComponent('로그인 처리 중 오류가 발생했습니다.')}`);
    }

    redirect('/');
}

export async function signup(formData: FormData) {
    let origin: string | null = null;
    try {
        const headerList = await headers();
        origin = headerList.get('origin') || headerList.get('referer') || null;
        
        // origin이 없을 경우 host 헤더를 기반으로 기본값 생성
        if (!origin) {
            const host = headerList.get('host');
            const protocol = headerList.get('x-forwarded-proto') || 'http';
            origin = host ? `${protocol}://${host}` : null;
        }
    } catch (e) {
        console.error('Error getting headers:', e);
    }

    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const passwordConfirm = formData.get('passwordConfirm') as string;
    const nickname = (formData.get('nickname') as string | null)?.trim() ?? '';
    const role = formData.get('role') as string | null;

    // 1. 유효성 검사 (Redirects throw errors that Next.js catches)
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        redirect(`/signup?error=${encodeURIComponent('유효한 이메일 주소를 입력해 주세요.')}`);
    }
    if (!password || password.length < 8) {
        redirect(`/signup?error=${encodeURIComponent('비밀번호는 8자 이상이어야 합니다.')}`);
    }
    if (password !== passwordConfirm) {
        redirect(`/signup?error=${encodeURIComponent('비밀번호가 일치하지 않습니다.')}`);
    }
    if (!nickname || nickname.length < 2 || nickname.length > 20) {
        redirect(`/signup?error=${encodeURIComponent('닉네임은 2자 이상 20자 이하로 입력해 주세요.')}`);
    }

    const termsAgreed = formData.get('termsAgreed');
    if (termsAgreed !== 'true') {
        redirect(`/signup?error=${encodeURIComponent('이용약관에 동의해 주세요.')}`);
    }

    try {
        const supabase = await createClient();

        const { error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                emailRedirectTo: origin ? `${origin}/auth/callback` : undefined,
                data: {
                    nickname,
                    role: role ?? null,
                },
            },
        });

        if (error) {
            console.error('Supabase signup error:', error.message);
            let userMessage = '회원가입 중 오류가 발생했습니다: ' + error.message;
            if (error.message.includes('rate limit exceeded')) {
                userMessage = '단시간에 너무 많은 가입 시도가 있었습니다. 잠시 후 다시 시도해 주세요.';
            } else if (error.message.includes('User already registered')) {
                userMessage = '이미 가입된 이메일 주소입니다.';
            }
            redirect(`/signup?error=${encodeURIComponent(userMessage)}`);
        }
    } catch (error: any) {
        // Next.js redirect errors는 다시 던져야 함
        if (error.digest?.startsWith('NEXT_REDIRECT')) {
            throw error;
        }
        console.error('Unexpected signup error:', error);
        redirect(`/signup?error=${encodeURIComponent('회원가입 처리 중 알 수 없는 오류가 발생했습니다.')}`);
    }

    redirect(`/signup?message=${encodeURIComponent('이메일을 확인해 주세요. 인증 링크를 통해 가입을 완료할 수 있습니다.')}`);
}

export async function signInWithOAuth(provider: 'google' | 'kakao') {
    const origin = (await headers()).get('origin');
    const supabase = await createClient();

    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: provider as any,
        options: {
            redirectTo: `${origin}/auth/callback`,
        },
    });

    if (error) {
        return redirect(`/login?error=${encodeURIComponent('소셜 로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.')}`);
    }

    if (data.url) {
        return redirect(data.url);
    }
}

export async function logout() {
    const supabase = await createClient();
    await supabase.auth.signOut();
    return redirect('/');
}
