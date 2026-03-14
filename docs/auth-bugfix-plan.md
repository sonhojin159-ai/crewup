# 🔧 Auth Actions 버그 수정 계획서

**작성일**: 2026-03-10
**대상 파일**: `src/app/auth/actions.ts`, `src/components/auth/OAuthButtons.tsx`
**버그 건수**: 4건 (높음 2건, 중간 1건, 낮음 1건)

---

## 수정 순서 요약

| # | 파일 | 심각도 | 설명 |
|---|------|--------|------|
| 1 | `actions.ts` | 높음 | 비밀번호 확인 서버 검증 추가 |
| 2 | `actions.ts` | 높음 | nickname/role 메타데이터 저장 |
| 3 | `actions.ts` + `OAuthButtons.tsx` | 중간 | 네이버 OAuth provider 오류 제거 |
| 4 | `actions.ts` | 낮음 | OAuth 에러 핸들링 추가 |

---

## BUG 1 — 비밀번호 확인 미검증 (높음)

### 문제
`signup` 함수가 `formData`에서 `passwordConfirm` 값을 읽지 않음.
HTML의 `required` / `minLength` 속성은 브라우저에서 우회 가능하므로, 비밀번호 불일치인 채로 Supabase 계정이 생성될 수 있음.

### 수정 위치
`src/app/auth/actions.ts` — `signup` 함수 내부, `const supabase = await createClient()` 호출 이전

### 수정 내용

**현재:**
```ts
const email = formData.get('email') as string;
const password = formData.get('password') as string;
// TODO: Handle extra fields like nickname and role if needed

const supabase = await createClient();
```

**수정 후:**
```ts
const email = formData.get('email') as string;
const password = formData.get('password') as string;
const passwordConfirm = formData.get('passwordConfirm') as string;
const nickname = (formData.get('nickname') as string | null)?.trim() ?? '';
const role = formData.get('role') as string | null;

// --- 서버사이드 입력값 검증 ---
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return redirect('/signup?error=유효한 이메일 주소를 입력해 주세요.');
}
if (!password || password.length < 8) {
    return redirect('/signup?error=비밀번호는 8자 이상이어야 합니다.');
}
if (password !== passwordConfirm) {
    return redirect('/signup?error=비밀번호가 일치하지 않습니다.');
}
if (!nickname || nickname.length < 2 || nickname.length > 20) {
    return redirect('/signup?error=닉네임은 2자 이상 20자 이하로 입력해 주세요.');
}

const supabase = await createClient();
```

### 검증 규칙 정리

| 필드 | 규칙 | 에러 메시지 |
|------|------|-------------|
| `email` | 형식 정규식 통과 | 유효한 이메일 주소를 입력해 주세요. |
| `password` | 8자 이상 | 비밀번호는 8자 이상이어야 합니다. |
| `passwordConfirm` | `password`와 일치 | 비밀번호가 일치하지 않습니다. |
| `nickname` | 2~20자, trim 후 판단 | 닉네임은 2자 이상 20자 이하로 입력해 주세요. |
| `role` | 필수 아님 (null 허용) | — |

---

## BUG 2 — nickname/role 데이터 유실 (높음)

### 문제
`supabase.auth.signUp()` 호출 시 `options.data`가 없어서, 폼에서 수집한 `nickname`과 `role`이 `auth.users.raw_user_meta_data`에 저장되지 않음.

### 수정 위치
`src/app/auth/actions.ts` — `supabase.auth.signUp()` 호출부

### 수정 내용

**현재:**
```ts
const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
        emailRedirectTo: `${origin}/auth/callback`,
    },
});
```

**수정 후:**
```ts
const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
        emailRedirectTo: `${origin}/auth/callback`,
        data: {
            nickname,
            role: role ?? null,
        },
    },
});
```

### 참고
- `nickname`, `role` 변수는 BUG 1 수정에서 이미 `formData`에서 읽어두었으므로 별도 추가 불필요
- 저장된 값은 `supabase.auth.getUser()` 응답의 `user.user_metadata`로 접근 가능
- 추후 별도 `profiles` 테이블 생성 시, auth 트리거로 `raw_user_meta_data`를 읽어 INSERT하는 로직 추가 필요

---

## BUG 3 — 네이버 OAuth 잘못된 provider (중간)

### 문제
`signInWithOAuth` 함수에서 `'naver'`가 `'notion'`으로 잘못 매핑되어 있음.
Supabase는 Naver를 기본 OAuth provider로 지원하지 않음.

```ts
// 현재 (버그)
provider: provider === 'naver' ? 'notion' : provider
```

### 수정 방향
MVP 단계에서는 **네이버 버튼 제거** 권장 (카카오 + 구글만 유지).

### 수정 내용 (2개 파일)

**파일 1 — `src/app/auth/actions.ts`**

```ts
// 현재:
export async function signInWithOAuth(provider: 'google' | 'kakao' | 'naver') {
    ...
    provider: provider === 'naver' ? 'notion' : provider,
    ...
}

// 수정 후 (BUG 4 수정 포함):
export async function signInWithOAuth(provider: 'google' | 'kakao') {
    const origin = (await headers()).get('origin');
    const supabase = await createClient();

    const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
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
```

**파일 2 — `src/components/auth/OAuthButtons.tsx`**

네이버 버튼 블록을 삭제합니다:
```tsx
// 삭제 대상:
<button
    onClick={() => signInWithOAuth('naver')}
    className="..."
>
    <span>🟢</span>
    네이버로 시작하기
</button>
```

---

## BUG 4 — OAuth 에러 무시 (낮음)

### 문제
`signInWithOAuth()` 반환 `error`를 체크하지 않아 실패 시 무반응.

### 수정 내용
BUG 3 수정에 이미 포함됨 (`if (error)` 블록 참고).

---

## 추가 점검 — middleware.ts 경고

- `src/middleware.ts` 구조는 정상이며 Supabase SSR 가이드와 일치
- Next.js 16에서 `middleware` 파일 관련 deprecation 경고가 출력될 수 있음
- `npm run dev` 실행 시 콘솔에서 `"Invalid matcher"` 경고 여부 확인 필요
- 현재는 동작에 문제 없으므로 비차단 이슈

---

## 최종 체크리스트

```
[ ] BUG 1: passwordConfirm 검증 + 이메일/비번/닉네임 서버 검증 추가
[ ] BUG 2: signUp() options.data에 { nickname, role } 추가
[ ] BUG 3-a: signInWithOAuth 타입에서 'naver' 제거 + 삼항 연산자 삭제
[ ] BUG 3-b: OAuthButtons.tsx 네이버 버튼 삭제
[ ] BUG 4: OAuth error 체크 후 redirect 처리 (BUG 3과 동시 수정)
[ ] 확인: npm run dev 실행 후 matcher 경고 여부 콘솔 점검
[ ] 확인: 회원가입 → 이메일 인증 → 로그인 전체 흐름 수동 테스트
[ ] 확인: Supabase 대시보드 > Authentication > Users에서 user_metadata 저장 확인
```

---

# 🔍 QA 전체 점검 결과 — 추가 수정 항목 (2026-03-11)

> Auth 버그(BUG 1~4)는 모두 수정 완료 확인됨. 아래는 전체 코드베이스 점검에서 새로 발견된 항목.

## 차단 요소 (최우선)

- [ ] **Supabase DB 스키마 미적용:** `profiles`, `crews`, `crew_members` 테이블 + RLS + 트리거가 Supabase에 아직 적용되지 않아 모든 API 호출이 실제로 실패함. DB 스키마부터 적용해야 이후 작업 진행 가능

---

## 버그 (BUG)

### BUG-5 — `<a>` 태그 사용 (낮음)
- **위치:** `src/app/crews/page.tsx:151`
- **문제:** 빈 상태 CTA 버튼이 `<a href="/crews/new">`를 사용. Next.js 내부 링크는 `<Link>` 컴포넌트를 써야 SPA 전환이 유지됨
- **수정:** `<a>` → `<Link>` 교체

### BUG-6 — `Crew.id` 타입 불일치 (높음)
- **위치:** `src/types/crew.ts` (`id: number`), `crews/[id]/dashboard/page.tsx:32`, `crews/[id]/missions/page.tsx:18`
- **문제:** `Crew.id`가 `number`이나 Supabase UUID는 `string`. `Number(params.id)` 비교 로직이 DB 연동 후 항상 `undefined` 반환
- **수정:** `id`를 `string`으로 변경, find 로직에서 `Number()` 변환 제거

### BUG-7 — dashboard/missions 페이지 DB 미연동 (높음)
- **위치:** `src/app/crews/[id]/dashboard/page.tsx`, `src/app/crews/[id]/missions/page.tsx`
- **문제:** 빈 `SAMPLE_CREWS` 배열에서 데이터 조회 → 항상 "크루를 찾을 수 없습니다" 출력
- **수정:** `crews/[id]/page.tsx`처럼 Supabase 직접 쿼리 또는 API 호출로 교체

### BUG-8 — 참여 버튼 인증 상태 미분기 (중간)
- **위치:** `src/app/crews/[id]/page.tsx:183`, `src/components/JoinCrewButton.tsx`
- **문제:** 비인증 사용자, 크루장, 이미 신청한 사용자에게도 "크루 참여 신청하기" 버튼 노출. 클릭 시 API 에러만 반환
- **수정:** 현재 사용자 세션 확인 후 버튼 숨김/비활성화/상태 텍스트 분기

### BUG-9 — 지출 승인 요청 버튼 핸들러 없음 (중간)
- **위치:** `src/app/crews/[id]/dashboard/page.tsx:229`
- **문제:** "승인 요청하기" 버튼에 `onClick`/`onSubmit` 없음. 클릭해도 무반응
- **수정:** API 연동 또는 최소한 미구현 alert 처리

### BUG-10 — Supabase error 변수 미사용 (낮음)
- **위치:** `src/app/crews/[id]/page.tsx:17`
- **문제:** `const { data: crew, error }` 에서 `error` 무시. DB 오류 원인 구분 불가
- **수정:** `if (error) console.error(error)` 또는 에러 종류별 분기

---

## ESLint 에러

- [ ] **`no-explicit-any` 8건:** `api/crews/route.ts`, `api/crews/[id]/join/route.ts`, `crews/[id]/page.tsx`, `crews/new/page.tsx`, `crews/page.tsx`, `Header.tsx`, `JoinCrewButton.tsx` → `any` 대신 Supabase 타입 또는 `import type { User } from '@supabase/supabase-js'` 사용
- [ ] **`@next/next/no-html-link-for-pages`:** BUG-5와 동일 건

---

## 주의 사항 (WARN)

- [ ] `login/page.tsx:49` — "비밀번호 찾기" 링크 `href="#"` 미구현
- [ ] `Footer.tsx:62~75` — 이용약관/개인정보처리방침/고객센터 링크 모두 `href="#"` (법적 리스크)
- [ ] `crews/[id]/missions/page.tsx:226` — 미션 인증 제출 시 `alert("DB 연동 전 데모")`. 실제 저장 안 됨
- [ ] `api/crews/route.ts:66` — 검색이 `title`만 지원. UI placeholder "크루명, 태그로 검색..."과 불일치
- [ ] `layout.tsx:24~28` — Pretendard 폰트 CDN 의존. 프로덕션 시 셀프호스팅 권장
- [ ] `middleware.ts` — Next.js 16 deprecated 경고. 향후 마이그레이션 대비 필요
- [ ] `crews/[id]/missions` — 미들웨어 보호 대상 아님. 비인증 사용자 접근 가능

---

## 권장 수정 순서

1. Supabase DB 스키마 적용 (차단 요소)
2. BUG-6: `Crew.id` 타입 `string` 변경
3. BUG-7: dashboard/missions DB 연동
4. BUG-5: `<a>` → `<Link>` 교체
5. BUG-8: 참여 버튼 인증 상태 분기
6. BUG-9, BUG-10: 핸들러/에러 처리
7. ESLint `any` 타입 정리
8. WARN 항목 순차 해결

---
---

# QA 테스트 + 보안 검사 결과 (2026-03-12)

> Anti-Gravity Phase 3 버그 수정 + Phase 4 Step 1 작업 완료 후 검수
> 빌드: TypeScript PASS / Next.js Build PASS / ESLint 39 errors, 12 warnings

---

## QA 버그 리포트

### BUG-11: [Critical] `input-field` CSS 클래스 미정의 — 충전 페이지 입력 깨짐

- **파일**: `src/app/wallet/charge/page.tsx:165`
- **문제**: 직접 입력 금액 input에 `className="input-field ..."` 사용. `globals.css`에 `.input-field` 미정의 (`.form-input`만 존재)
- **재현**: `/wallet/charge` → 직접 입력 필드 스타일 깨짐
- **수정**: `input-field` → `form-input`

---

### BUG-12: [Major] missions 완료 상태 항상 미완료로 표시

- **파일**: `src/app/crews/[id]/missions/page.tsx:76, 142-179`
- **문제**: `missions` 테이블에 `completed` 컬럼이 없음. 미션 완료 여부는 `mission_verifications` 테이블로 추적되는데, 쿼리가 `completed` 필드를 참조 → 항상 `undefined` → `false`
- **영향**: 크루장이 미션 인증해도 missions 페이지에서 완료 표시 안 됨. 진행률 원형 그래프 항상 0%
- **수정**: 쿼리를 `.select('*, missions(*, mission_verifications(id))')` 로 변경, `mission.mission_verifications?.length > 0`으로 판단

---

### BUG-13: [Major] 홈페이지 크루 카드에 track 배지 미표시

- **파일**: `src/app/page.tsx:19-28`
- **문제**: Supabase 결과 → Crew 매핑 시 `track` 필드 누락. `CrewCard`가 `crew.track`으로 배지 렌더링하는데 값이 없음
- **수정**: 매핑에 `track: row.track as Crew["track"]` 추가

---

### BUG-14: [Major] 애니메이션 클래스 미동작

- **파일**: `src/app/crews/[id]/ledger/page.tsx:168`
- **문제**: `animate-in fade-in slide-in-from-top-4` 클래스 사용하나 `tailwindcss-animate` 미설치
- **수정 A**: `npm install tailwindcss-animate`
- **수정 B**: 해당 클래스 제거, `transition-all duration-300`으로 대체

---

### BUG-15: [Minor] 미션 인증 제출이 alert() 데모 스텁

- **파일**: `src/app/crews/[id]/missions/page.tsx:269-272`
- **문제**: "인증 제출" 버튼이 `alert("인증이 제출되었습니다! (DB 연동 전 데모)")` 만 실행. 실제 DB 저장 없음
- **참고**: `/api/crews/[id]/missions/[missionId]/verify` API는 크루장 전용. 일반 크루원용 인증 제출 API 별도 필요

---

### BUG-16: [Minor] 인증 피드 하드코딩 더미 데이터

- **파일**: `src/app/crews/[id]/missions/page.tsx:11-15`
- **문제**: `VERIFICATION_FEED` 상수에 고정된 3개 가짜 데이터. `mission_verifications` 쿼리로 교체 필요

---

### BUG-17: [Minor] leave API — balance_after 하드코딩 0

- **파일**: `src/app/api/crews/[id]/leave/route.ts:89`
- **문제**: 탈퇴 시 `point_transactions`에 `balance_after: 0` 고정. 감사 로그에 잘못된 잔액 기록
- **수정**: `user_points`에서 실제 balance 조회 후 입력

---

### BUG-18: [Minor] dashboard dead code — 미사용 변수 7건

- **파일**: `src/app/crews/[id]/dashboard/page.tsx:13-15, 31, 159`
- **문제**: `EXPENSES`, `STATUS_STYLE`, `STATUS_LABEL`, `expenseForm`, `missionRate` 선언 후 미사용
- **수정**: 전부 삭제

---

### QA 주의사항 (WARN)

| # | 내용 | 파일 |
|---|------|------|
| WARN-01 | ESLint `no-explicit-any` 39건 (dashboard, ledger, charge 집중) | 다수 |
| WARN-02 | useEffect 의존성 배열 누락 (stale closure 위험) | dashboard:95, ledger:65 |
| WARN-03 | `<img>` 직접 사용 — Next.js `<Image>` 권장 | ledger:288 |
| WARN-04 | Next.js 16 middleware 명칭 변경 경고 (비차단) | middleware.ts |
| WARN-05 | approve RPC와 명시적 상태 업데이트 중복 가능성 | approve/route.ts:47-68 |

---
---

## 보안 검사 리포트

> OWASP Top 10 기준 분류. 보안 점수: 4/10

### SEC-01: [Critical] 결제 확인 API — 타인 계정 포인트 충전 가능

- **파일**: `src/app/api/payments/confirm/route.ts:7`
- **OWASP**: A01 Broken Access Control
- **취약점**: 클라이언트가 전송한 `userId`로 포인트 귀속. 공격자가 본인 `receiptId` + 타인 `userId`를 보내면 타인 계정에 포인트 충전
- **수정**:
```ts
// userId를 body에서 제거, 세션에서 추출
const { data: { user } } = await supabase.auth.getUser();
if (!user) return NextResponse.json({ error: '인증 필요' }, { status: 401 });
// RPC 호출 시 p_user_id: user.id 사용
```

---

### SEC-02: [Critical] 충전 페이지 — userId 클라이언트 전송

- **파일**: `src/app/wallet/charge/page.tsx:104-108`
- **OWASP**: A01 Broken Access Control
- **취약점**: SEC-01과 쌍. body에서 `userId` 필드 제거 필요

---

### SEC-03: [Critical] 에스크로 배분 함수 — escrow_balance 음수 방지 없음

- **파일**: `docs/schema-phase4-functions.sql:143-155`
- **OWASP**: A04 Insecure Design
- **취약점**: `distribute_mission_reward`에서 escrow_balance 차감 시 잔액 확인 없음. 동시 미션 인증이나 부분 차감 상태에서 음수 발생 → 포인트 장부 무결성 붕괴
- **수정**: 차감 전 `FOR UPDATE`로 잠금 + 잔액 확인, 부족 시 RAISE EXCEPTION

---

### SEC-04: [Critical] ledger-evidence Storage 버킷 public 설정

- **파일**: `docs/schema-ledger.sql:93`
- **OWASP**: A01 Broken Access Control
- **취약점**: 증빙 파일(영수증, 통장 내역 등) URL 패턴 알면 비멤버도 열람 가능
- **수정**: `public: false` + Signed URL 사용 + 크루 멤버 전용 Storage RLS

---

### SEC-05: [High] 미들웨어 보호 라우트 누락

- **파일**: `src/lib/supabase/middleware.ts:43-44`
- **OWASP**: A01 Broken Access Control
- **누락**: `/crews/[id]/ledger`, `/crews/[id]/missions` 미보호
- **수정**: 정규식으로 `/crews/[id]/(dashboard|chat|ledger|missions)` 패턴 추가

---

### SEC-06: [High] 장부 동의 확정 Race Condition

- **파일**: `src/app/api/crews/[id]/ledger/[entryId]/approve/route.ts:69-91`
- **OWASP**: A04 Insecure Design
- **취약점**: 동시 마지막 동의 시 is_locked 두 번 업데이트. 원자성 없음
- **수정**: 전원 동의 확인 + 잠금을 하나의 PostgreSQL RPC 함수로 이전

---

### SEC-07: [High] 장부 조회 — 크루 멤버 여부 미확인

- **파일**: `src/app/api/crews/[id]/ledger/route.ts:20-40`
- **OWASP**: A01 Broken Access Control
- **취약점**: 로그인한 모든 유저가 임의 크루의 매출/지출 장부 전체 조회 가능
- **참고**: RLS가 `SELECT USING (true)`이므로 의도된 공개 정책인지 재검토 필요

---

### SEC-08: [High] 승인 API — IDOR (memberId 크루 소속 미검증)

- **파일**: `src/app/api/crews/[id]/approve/[memberId]/route.ts`
- **OWASP**: A01 Broken Access Control
- **취약점**: 크루장 A가 다른 크루 B의 memberId를 URL에 넣으면 RPC에서 잘못된 크루 포인트 정책 적용. RPC 단계에서 이미 포인트 차감 발생 가능
- **수정**: RPC 호출 전 `crew_members.eq('id', memberId).eq('crew_id', id).eq('status', 'pending')` 검증 추가

---

### SEC-09: [High] OAuth 콜백 — Open Redirect

- **파일**: `src/app/auth/callback/route.ts:7`
- **OWASP**: A01 Broken Access Control
- **취약점**: `?next=//evil.com` 으로 피싱 사이트 리다이렉트 가능
- **수정**:
```ts
const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/';
```

---

### SEC-10: [High] 전체 API — Rate Limiting 부재

- **OWASP**: A05 Security Misconfiguration
- **영향**: 특히 `/api/payments/confirm` (이중 충전 시도), `/api/crews/[id]/approve` (반복 포인트 차감)
- **수정**: 최소 결제 관련 API에 우선 적용 (Vercel WAF 또는 미들웨어 IP 기반 제한)

---

### SEC-11: [Medium] crew_members RLS SELECT 전체 공개

- **파일**: `docs/schema.sql:57`
- **문제**: 모든 크루의 멤버 목록, 결제 상태, 승인 일시가 비로그인 조회 가능
- **수정**: 본인/크루장/같은 크루 활성 멤버만 조회 가능하도록 RLS 변경

---

### SEC-12: [Medium] 에러 메시지에 DB 내부 정보 노출

- **파일**: `api/crews/route.ts:129`, `api/crews/[id]/join/route.ts:64` 등 다수
- **문제**: `error.message` 그대로 반환 → Supabase/Postgres 내부 오류 노출
- **수정**: 500 에러는 `서버 오류가 발생했습니다.` 반환, 상세는 `console.error`만

---

### SEC-13: [Medium] 크루 생성 입력값 범위 검증 부족

- **파일**: `src/app/api/crews/route.ts`
- **문제**: `maxMembers: 9999`, tags 수백 개, title 무한 길이 등 제한 없음
- **수정**: maxMembers 2~50 범위, tags 최대 5개(각 20자), title 100자, description 2000자

---

### SEC-14: [Medium] 증빙 파일 확장자 검증 우회 가능

- **파일**: `src/app/api/crews/[id]/ledger/[entryId]/evidence/route.ts:40-41`
- **문제**: 파일 확장자/MIME 타입 화이트리스트 없음. `.php`, `.exe` 등 업로드 가능
- **수정**: ALLOWED_TYPES = `['image/jpeg','image/png','image/webp','application/pdf']` 화이트리스트

---

### SEC-15: [Medium] 증빙 업로드 — 크루 멤버 여부 미확인

- **파일**: `src/app/api/crews/[id]/ledger/[entryId]/evidence/route.ts`
- **문제**: `created_by === user.id`만 확인. 크루 멤버 여부 검증 레이어 부족

---

### SEC-16: [Medium] 거래 내역 API — limit 상한 없음

- **파일**: `src/app/api/wallet/transactions/route.ts:15`
- **문제**: `limit=999999` 허용 → 대량 데이터 조회 DoS 가능
- **수정**: `Math.min(limit, 100)`

---

### SEC-17~21: [Low] 기타

| # | 내용 | 파일 |
|---|------|------|
| SEC-17 | 로그인 에러 메시지 URL 평문 노출 | auth/actions.ts:19 |
| SEC-18 | 닉네임 특수문자 필터링 없음 | auth/actions.ts:43 |
| SEC-19 | Realtime 구독 RLS 확인 필요 (crew_messages) | ChatRoom.tsx |
| SEC-20 | leave API balance_after 하드코딩 (= BUG-17) | leave/route.ts:89 |
| SEC-21 | DB 제약 `<=90` vs API 검증 `===100` 충돌 → 크루 생성 실패 가능 | schema-phase4.sql:11 |

---

## 수정 우선순위 요약

### 즉시 수정 (Critical + 기능 차단)

| 순위 | 항목 | 이유 |
|------|------|------|
| 1 | SEC-01 + SEC-02 | **타인 계정 포인트 충전 가능** — 결제 API 최우선 |
| 2 | SEC-03 | 에스크로 잔액 음수 → 장부 무결성 붕괴 |
| 3 | SEC-04 | 증빙 파일(영수증, 통장) 전체 공개 |
| 4 | SEC-21 | DB 제약과 API 검증 충돌 → 크루 생성 자체 불가 가능성 |
| 5 | BUG-11 | 충전 페이지 입력 UI 깨짐 |

### 빠른 수정 (High + Major)

| 순위 | 항목 | 이유 |
|------|------|------|
| 6 | SEC-08 | IDOR — 다른 크루 멤버 포인트 잘못 차감 |
| 7 | SEC-09 | Open Redirect → 피싱 공격 |
| 8 | BUG-12 | 미션 완료 표시 안 됨 → 핵심 UX 결함 |
| 9 | BUG-13 | 홈 크루 카드 트랙 배지 누락 |
| 10 | SEC-05 | ledger/missions 라우트 미보호 |
| 11 | SEC-06 | 장부 잠금 race condition |
| 12 | SEC-07 | 장부 비멤버 조회 가능 (정책 재검토) |

### 계획적 수정 (Medium + Minor)

| 항목 | 내용 |
|------|------|
| SEC-10 | Rate Limiting (최소 결제 API) |
| SEC-11~16 | RLS 강화, 에러 메시지, 입력 범위, 파일 검증 |
| BUG-14~18 | 애니메이션, alert 스텁, dead code 등 |
| WARN-01~05 | ESLint any, useEffect 의존성, img 태그 |
