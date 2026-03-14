# Bug Report - 2026-03-14 (2차 검증)

> 1차 점검(03-13) 이후 수정 사항 반영 확인 + 신규 발견 이슈 포함

---

## 수정 완료 항목

| ID | 항목 | 상태 |
|----|------|------|
| C1 | signup redirect 에러 경로 encodeURIComponent (5개) | 수정 완료 |
| C2 | Bootpay TS2351 컴파일 에러 | 수정 완료 |
| C3 | approve RPC 에러 메시지 노출 | 수정 완료 |
| M6 | 전역 error.tsx / not-found.tsx / loading.tsx | 수정 완료 |
| M4 | 기프티콘 빈 상태 UI | 부분 수정 (안내 메시지 추가) |
| m5 | 타입 파일 분산 | 부분 수정 (payment.ts 추가) |

---

## Critical (즉시 수정)

### C1-1. signup 성공 redirect 인코딩 누락 (신규 발견)
- **위치**: `src/app/auth/actions.ts:115`
- **증상**: 회원가입 성공 시 "Invalid character in header content" 에러 발생
- **원인**: 에러 경로 5개는 수정되었으나, 성공 메시지 redirect가 미수정
- **현재 코드**:
```typescript
redirect(`/signup?message=이메일을 확인해 주세요. 인증 링크를 통해 가입을 완료할 수 있습니다.`);
```
- **수정 방법**:
```typescript
redirect(`/signup?message=${encodeURIComponent('이메일을 확인해 주세요. 인증 링크를 통해 가입을 완료할 수 있습니다.')}`);
```

### C4. ledger approve result.error 직접 반환 (미수정)
- **위치**: `src/app/api/crews/[id]/ledger/[entryId]/approve/route.ts:59~61`
- **현황**: `rpcError` 처리는 수정되었으나, `result.error`가 여전히 클라이언트에 그대로 전달됨
- **현재 코드**:
```typescript
if (result && !result.success) {
  return NextResponse.json({ error: result.error }, { status: 400 });
}
```
- **수정 방법**:
```typescript
if (result && !result.success) {
  console.error('Ledger approve business error:', result.error);
  return NextResponse.json({ error: '장부 승인 처리에 실패했습니다.' }, { status: 400 });
}
```

---

## Major (우선 수정)

### M3. 네이버 OAuth 버튼 잔존 (미수정)
- **위치**: `src/components/auth/OAuthButtons.tsx:15~23`
- **현황**: 네이버 버튼 + actions.ts 타입에 `'naver'` 여전히 포함
- **수정 방법**: 네이버 버튼 JSX 제거, actions.ts 타입에서 `'naver'` 제거

### M7. 대시보드 서버 측 권한 체크 없음 (미수정)
- **위치**: `src/app/crews/[id]/dashboard/page.tsx`
- **수정 방법**: `layout.tsx` 서버 컴포넌트 추가, 크루장 여부 체크 후 리다이렉트

### M8. payment.ts userId 필드 잔존 (미수정)
- **위치**: `src/types/payment.ts:34`
- **수정 방법**: `userId: string` 필드 제거

### W1. (신규) profiles 전체 컬럼 SELECT — 민감 정보 노출
- **위치**: `src/app/api/crews/[id]/route.ts:15`
- **현황**: `profiles:created_by(*)` 로 profiles 전체 컬럼 조회 (인증 없이 접근 가능)
- **영향**: email, phone 등 민감 컬럼이 외부에 노출될 수 있음
- **수정 방법**:
```typescript
// 수정 전
.select('*, profiles:created_by(*), crew_members(*, profiles(*))')

// 수정 후
.select('*, profiles:created_by(id, nickname, avatar_url), crew_members(id, status, user_id, profiles(id, nickname, avatar_url))')
```

### W2. (신규) 미션 피드 API 멤버십 검증 누락
- **위치**: `src/app/api/crews/[id]/missions/feed/route.ts:18`
- **현황**: 로그인만 확인, 해당 크루 멤버인지 미확인
- **수정 방법**: `crew_members` 테이블에서 멤버십 확인 로직 추가 (submit/route.ts 패턴 참고)

---

## Minor

### m1. tmp 파일 8개 미삭제
- **파일 목록**: `tmp_debug_signup.ts`, `tmp_inspect_db.ts`, `tmp_test_creation.ts`, `tmp_inspect_crews.ts`, `tmp_check_columns.ts`, `tmp_verify_trigger.ts`, `tmp_check_conflict.ts`, `temp-points.mjs`
- **수정 방법**: 전부 삭제

### m4. 에스크로 몰수 금액 중복 합산 버그 (미수정)
- **위치**: `src/app/api/crews/[id]/leave/route.ts:77~82`
- **현황**: forfeited 상태 전체 조회 → 이전 몰수 내역까지 합산 가능
- **수정 방법**: UPDATE 반환값의 amount를 직접 사용하거나, 이번 탈퇴 건만 필터링

### m6. (신규) ADMIN_EMAILS 빈 문자열 처리
- **위치**: `src/lib/admin.ts:5`
- **현황**: 환경변수 비어있으면 `['']` 생성됨
- **수정 방법**: `.filter(e => e.length > 0)` 추가

### m7. (신규) 검색 쿼리 길이 제한 없음
- **위치**: `src/app/api/crews/route.ts:219`
- **수정 방법**: `searchQuery.slice(0, 50)` 추가

### m8. (신규) 미션 인증 내용 길이 제한 없음
- **위치**: `src/app/api/crews/[id]/missions/submit/route.ts:24`
- **수정 방법**: `if (content.length > 1000)` 체크 추가

### m9. (신규) wallet transactions limit 상한선 없음
- **위치**: `src/app/api/wallet/transactions/route.ts:15`
- **수정 방법**:
```typescript
const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
```

---

## 미구현 기능 (향후 Sprint 배치 필요)

| ID | 항목 | 비고 |
|----|------|------|
| M1 | 프로필/마이페이지 | 닉네임/아바타/역할 수정 불가 |
| M2 | 비밀번호 찾기 | login 페이지 `href="#"` |
| M4 | 기프티콘 교환 | `GIFTICONS = []`, DB/API 미구현 |
| M5 | 미션 리워드 신청 | alert만 존재, API 미연동 |
| m2 | schema-sprint8.sql | Supabase에 미적용 |
| m3 | Rate Limiter 업그레이드 | Vercel 배포 전 Upstash 전환 필요 |
