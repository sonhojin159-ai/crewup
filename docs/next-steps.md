# CrewUp 추가 진행 방향

---

## 2026-03-10 | Phase 3 상세 기획 — DB 스키마 + CRUD API + 인증 상태 반영

### 전제 결정사항
- Phase 2.5 MVP 검증은 스킵 → Phase 3 바로 진입 (DB 없이는 검증 자체가 불가)
- 미션 테이블은 코어 테이블 완성 후 별도 단계에서 추가
- 가장 빠른 경로: **코어 3개 테이블 → 4개 API → 페이지 연동 → Header 인증**

---

### STEP 1. DB 스키마 생성 (Supabase SQL Editor)

#### 1-1. `profiles` 테이블
> auth.users와 1:1 연동되는 앱 프로필

```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL,
  role TEXT CHECK (role IN ('investor', 'operator', 'both')) DEFAULT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 회원가입 시 자동 생성 트리거
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, nickname, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nickname', '크루원'),
    NEW.raw_user_meta_data->>'role'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

**RLS 정책:**
```sql
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 누구나 프로필 조회 가능
CREATE POLICY "profiles_select" ON profiles
  FOR SELECT USING (true);

-- 본인만 수정 가능
CREATE POLICY "profiles_update" ON profiles
  FOR UPDATE USING (auth.uid() = id);
```

#### 1-2. `crews` 테이블

```sql
CREATE TABLE crews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  role_type TEXT NOT NULL CHECK (role_type IN ('investor', 'operator', 'both')),
  description TEXT NOT NULL,
  max_members INT NOT NULL DEFAULT 6,
  tags TEXT[] DEFAULT '{}',
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**RLS 정책:**
```sql
ALTER TABLE crews ENABLE ROW LEVEL SECURITY;

-- 누구나 크루 목록/상세 조회 가능
CREATE POLICY "crews_select" ON crews
  FOR SELECT USING (true);

-- 로그인한 사용자만 생성 가능
CREATE POLICY "crews_insert" ON crews
  FOR INSERT WITH CHECK (auth.uid() = created_by);

-- 크루장만 수정 가능
CREATE POLICY "crews_update" ON crews
  FOR UPDATE USING (auth.uid() = created_by);

-- 크루장만 삭제 가능
CREATE POLICY "crews_delete" ON crews
  FOR DELETE USING (auth.uid() = created_by);
```

#### 1-3. `crew_members` 테이블

```sql
CREATE TABLE crew_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crew_id UUID NOT NULL REFERENCES crews(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'active', 'rejected')) DEFAULT 'pending',
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(crew_id, user_id)
);
```

**RLS 정책:**
```sql
ALTER TABLE crew_members ENABLE ROW LEVEL SECURITY;

-- 누구나 멤버 목록 조회 가능 (크루 상세에서 멤버 수 표시)
CREATE POLICY "crew_members_select" ON crew_members
  FOR SELECT USING (true);

-- 로그인한 사용자가 자기 자신으로만 참여 신청 가능
CREATE POLICY "crew_members_insert" ON crew_members
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 크루장만 멤버 상태(승인/반려) 변경 가능
CREATE POLICY "crew_members_update" ON crew_members
  FOR UPDATE USING (
    auth.uid() IN (
      SELECT created_by FROM crews WHERE id = crew_id
    )
  );
```

#### 1-4. 크루 생성 시 크루장 자동 등록 트리거

```sql
CREATE OR REPLACE FUNCTION handle_crew_created()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.crew_members (crew_id, user_id, status)
  VALUES (NEW.id, NEW.created_by, 'active');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_crew_created
  AFTER INSERT ON crews
  FOR EACH ROW EXECUTE FUNCTION handle_crew_created();
```

---

### STEP 2. 크루 CRUD API Routes

#### 2-1. `POST /api/crews` — 크루 생성

```
파일: src/app/api/crews/route.ts

동작:
1. 세션 확인 (미인증 → 401)
2. body에서 title, category, roleType, description, maxMembers, tags 추출
3. 서버사이드 검증 (title 필수, category 필수 등)
4. supabase.from('crews').insert() 호출
5. 성공 시 201 + 생성된 크루 데이터 반환

연동 대상: /crews/new/page.tsx
- alert() 제거
- fetch('/api/crews', { method: 'POST' }) 호출
- 성공 시 router.push(`/crews/${data.id}`)
```

#### 2-2. `GET /api/crews` — 크루 목록 조회

```
파일: src/app/api/crews/route.ts (같은 파일, GET 핸들러)

동작:
1. searchParams에서 category, role, search 추출
2. supabase.from('crews').select('*, crew_members(count)') 쿼리
3. 필터 조건 동적 적용
4. 200 + 크루 배열 반환

연동 대상: /crews/page.tsx
- SAMPLE_CREWS 제거 (이미 빈 배열)
- useEffect + fetch로 API 호출
- 기존 필터 로직은 서버사이드 쿼리로 이동
```

#### 2-3. `GET /api/crews/[id]` — 크루 상세 조회

```
파일: src/app/api/crews/[id]/route.ts

동작:
1. params에서 id 추출
2. supabase.from('crews').select('*, crew_members(*, profiles(*))').eq('id', id).single()
3. 없으면 404, 있으면 200 + 크루 데이터

연동 대상: /crews/[id]/page.tsx
- SAMPLE_CREWS.find() 제거
- 서버 컴포넌트에서 직접 supabase 호출 (API Route 불필요할 수도 있음)
- 또는 fetch로 API 호출
```

#### 2-4. `POST /api/crews/[id]/join` — 참여 신청

```
파일: src/app/api/crews/[id]/join/route.ts

동작:
1. 세션 확인 (미인증 → 401)
2. 이미 참여 중인지 확인 (중복 방지)
3. 크루 정원 초과 확인
4. crew_members에 status='pending'으로 INSERT
5. 201 반환

연동 대상: /crews/[id]/page.tsx
- "크루 참여 신청하기" 버튼 onClick에 연결
```

---

### STEP 3. 페이지 수정 사항

| 페이지 | 변경 내용 |
|--------|-----------|
| `/crews/new/page.tsx` | alert() → API POST 호출, 성공 시 상세 페이지 이동 |
| `/crews/page.tsx` | API GET으로 크루 목록 fetch, 서버사이드 필터링 |
| `/crews/[id]/page.tsx` | API 또는 서버 컴포넌트에서 크루 데이터 fetch |
| `/page.tsx` (랜딩) | 크루 수 카운트를 API에서 가져오기 (선택) |

---

### STEP 4. Header 인증 상태 반영 + 라우트 보호

#### 4-1. Header 수정
```
현재: 항상 "로그인 / 회원가입" 버튼 표시
수정: 서버에서 user 세션 읽어서 분기

- 미로그인: 로그인 / 회원가입 버튼
- 로그인: 닉네임 표시 + 로그아웃 버튼 + 마이페이지 링크
```

#### 4-2. logout 서버 액션 추가
```
파일: src/app/auth/actions.ts

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return redirect('/');
}
```

#### 4-3. 미들웨어 라우트 보호
```
파일: src/middleware.ts

보호 대상 라우트:
- /crews/new → 미인증 시 /login으로 리다이렉트
- /wallet → 미인증 시 /login으로 리다이렉트
- /crews/[id]/dashboard → 미인증 시 /login으로 리다이렉트
```

---

### 작업 순서 체크리스트

```
[ ] STEP 1-1: profiles 테이블 + 트리거 생성 (Supabase SQL Editor)
[ ] STEP 1-2: crews 테이블 + RLS 생성
[ ] STEP 1-3: crew_members 테이블 + RLS 생성
[ ] STEP 1-4: 크루 생성 시 크루장 자동 등록 트리거
[ ] STEP 2-1: POST /api/crews 구현
[ ] STEP 2-2: GET /api/crews 구현
[ ] STEP 2-3: GET /api/crews/[id] 구현
[ ] STEP 2-4: POST /api/crews/[id]/join 구현
[ ] STEP 3: 페이지 연동 (new → list → detail → join)
[ ] STEP 4-1: Header 로그인 상태 분기
[ ] STEP 4-2: logout 서버 액션
[ ] STEP 4-3: 미들웨어 라우트 보호
[ ] 통합 테스트: 회원가입 → 로그인 → 크루 생성 → 목록 → 상세 → 참여 신청
```

### 예상 결과
위 작업 완료 시 **실제로 동작하는 MVP 코어 플로우**가 완성됨:
1. 회원가입/로그인 (이메일 + 소셜)
2. 크루 생성 (카테고리, 역할군, 태그)
3. 크루 목록 조회 + 필터/검색
4. 크루 상세 보기
5. 크루 참여 신청

---

## 2026-03-11 | Phase 3 진행 현황 및 다음 작업 계획

### 현재까지 완료된 항목

```
[x] STEP 2-1: POST /api/crews 구현
[x] STEP 2-2: GET /api/crews 구현
[x] STEP 2-3: GET /api/crews/[id] 구현
[x] STEP 2-4: POST /api/crews/[id]/join 구현
[x] STEP 3: 페이지 연동 (new → list → detail → join)
[x] STEP 4-1: Header 로그인 상태 분기
[x] STEP 4-2: logout 서버 액션
[x] STEP 4-3: 미들웨어 라우트 보호
[x] Auth 버그 4건 수정 완료 (BUG 1~4)
```

### 미완료 (차단 요소)

```
[ ] STEP 1-1~1-4: Supabase DB 스키마 전체 미적용
    → 코드는 완성되었으나 실제 DB에 테이블이 없어 모든 API가 동작 불가
```

### QA에서 발견된 추가 버그 6건 (auth-bugfix-plan.md BUG 5~10 참고)

---

### 다음 작업 순서

#### STEP A. Supabase DB 스키마 적용 (차단 해소)
> Supabase SQL Editor에서 직접 실행. 코드 작업 아님.

```
[ ] A-1: profiles 테이블 + handle_new_user 트리거 생성
[ ] A-2: crews 테이블 + RLS 정책 생성
[ ] A-3: crew_members 테이블 + RLS 정책 생성
[ ] A-4: handle_crew_created 트리거 생성
[ ] A-5: Supabase 대시보드에서 카카오/구글 OAuth provider 활성화
[ ] A-6: 환경변수(.env.local) SUPABASE_URL, SUPABASE_ANON_KEY 확인
```

#### STEP B. QA 버그 수정 (코드 작업)
> DB 적용 후 바로 진행. 빠르게 끝나는 것부터 처리.

```
[ ] B-1: Crew.id 타입 number → string 변경 (types/crew.ts + 관련 페이지)
[ ] B-2: crews/page.tsx <a> → <Link> 교체 (1줄 수정)
[ ] B-3: crews/[id]/page.tsx Supabase error 변수 처리
[ ] B-4: JoinCrewButton 인증 상태 분기 (비인증/크루장/이미 신청 시 버튼 분기)
[ ] B-5: dashboard/missions 페이지 Supabase 직접 쿼리로 전환 (SAMPLE_CREWS 제거)
[ ] B-6: 지출 승인 요청 버튼 미구현 alert 처리
[ ] B-7: ESLint any 타입 8건 정리
```

#### STEP C. 통합 테스트
> DB + 버그 수정 후 전체 플로우 검증.

```
[ ] C-1: 회원가입 (이메일) → Supabase Users 확인 → profiles 자동 생성 확인
[ ] C-2: 소셜 로그인 (카카오/구글) 동작 확인
[ ] C-3: 크루 생성 → DB 저장 확인 → 크루장 자동 등록 확인
[ ] C-4: 크루 목록 조회 + 카테고리/역할/검색 필터 확인
[ ] C-5: 크루 상세 페이지 → 멤버 정보 표시 확인
[ ] C-6: 크루 참여 신청 → crew_members pending 상태 확인
[ ] C-7: 미인증 사용자 보호 라우트 리다이렉트 확인
[ ] C-8: npm run build 에러 0, ESLint 에러 0 확인
```

#### STEP D. 마무리 및 Phase 2.5 진입
> 통합 테스트 통과 후.

```
[ ] D-1: 비밀번호 찾기 페이지 구현 (Supabase resetPasswordForEmail 연동)
[ ] D-2: 이용약관/개인정보처리방침 페이지 최소 작성 (법적 리스크 해소)
[ ] D-3: Pretendard 폰트 셀프호스팅 전환
[ ] D-4: Vercel 배포 → 10~20명 소규모 테스트 시작 (Phase 2.5)
```

---

### 작업 흐름 요약

```
A (DB 적용) → B (버그 수정) → C (통합 테스트) → D (마무리 + 배포)
               ↑ 여기서부터 코드 작업
```

- **A**는 Supabase 대시보드에서 SQL 실행 (사용자 직접 수행)
- **B**는 코드 수정 (Claude가 지원)
- **C**는 수동 테스트 + 빌드 검증
- **D**까지 완료되면 **실제 사용자가 테스트 가능한 MVP** 완성

---
---

## 2026-03-11 | 사업 계획서 점검 — 듀얼 트랙 모델 반영 GAP 분석 및 로드맵

### 사업 계획서 핵심 요약

크루업은 두 가지 트랙을 동시에 운영하는 듀얼 트랙 플랫폼이다.

| 구분 | Track A: 미션 달성형 | Track B: 수익 분배형 |
|------|---------------------|---------------------|
| 목적 | 습관 형성, 자기계발 | 실제 동업/공동 창업 |
| 수익 구조 | 보증금 기반 (실패자 → 성공자/크루장/플랫폼 분배) | 매출 기반 (합의 비율 분배, P2P 직접 송금) |
| 핵심 기능 | 미션 인증샷, 보증금 예치/환급 | 일일 투명 장부, 정산서 발행 |
| 수수료 | 가입 시 정액제 (6인 미만 3,000 / 6인 이상 5,000 포인트) | 동일 |

---

### 현재 구현 상태 vs 사업 계획서 GAP 분석

| # | 사업 계획서 요구사항 | 현재 구현 상태 | GAP |
|---|---------------------|---------------|-----|
| 1 | 듀얼 트랙 (미션형/동업형) 크루 구분 | roleType(investor/operator/both)만 존재, 트랙 개념 없음 | 크루 생성 시 track 필드 추가 필요 |
| 2 | 보증금 시스템 (예치/환급/몰수) | 미구현 | DB 스키마 + 지갑 연동 필요 |
| 3 | 미션 인증샷 업로드 | missions 페이지 UI만 존재, 실제 업로드 없음 | 파일 업로드 (Supabase Storage) + 인증 승인 로직 |
| 4 | 보증금 분배 로직 (성공률 기반) | 미구현 | 성공률 계산 + 분배 알고리즘 |
| 5 | 일일 투명 장부 (Ledger) | 미구현 | 핵심 신규 개발 필요 |
| 6 | 장부 상호 검토 및 데이터 락(Lock) | 미구현 | 동의 시스템 + 수정 불가 잠금 로직 |
| 7 | 장부 수정 중재 (운영자 권한) | 미구현 | 관리자 패널 필요 |
| 8 | 정산서 발행 | 미구현 | 정산 요약 생성 + PDF/이미지 출력 |
| 9 | 수수료 체계 (인원수 기반 정액제) | entry_points 필드 존재하나 고정 정액이 아님 | 6인 기준 분기 로직으로 교체 |
| 10 | 면책 조항 동의 시스템 | 투명성 가이드라인 문서만 존재, UI 미구현 | 장부 확정 시 면책 동의 체크박스 + 법적 문구 |
| 11 | 리스크 방어 (50% 미만 인출 불가) | 미구현 | 진행률 연동 인출 제한 로직 |
| 12 | 미션 데드라인 강제 반영 | 미구현 | 크론/스케줄러 또는 API 호출 시 체크 |
| 13 | 우수 크루장 상금/유료 노출(AD) | 미구현 | Phase 후반 |
| 14 | 기프티콘 교환 수수료 | 월렛 UI만 존재, 실제 교환 미연동 | 외부 API 연동 필요 |
| 15 | P2P 정산 (유저 간 직접 송금) | 미구현 | 정산서 + 송금 안내 UI |

---

### 단계별 수정 로드맵

---

#### Phase 4. 듀얼 트랙 기반 구조 전환

> Phase 3(기존 CRUD + Auth) 완료 후 진행. 크루업의 핵심 차별점을 만드는 단계.

##### STEP 4-1. DB 스키마 확장 — 트랙 구분 + 보증금

```sql
-- crews 테이블에 트랙 구분 추가
ALTER TABLE crews ADD COLUMN track TEXT NOT NULL DEFAULT 'mission'
  CHECK (track IN ('mission', 'revenue_share'));

-- 보증금 테이블
CREATE TABLE deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crew_id UUID NOT NULL REFERENCES crews(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount INT NOT NULL,          -- 포인트 단위
  status TEXT NOT NULL DEFAULT 'held'
    CHECK (status IN ('held', 'refunded', 'forfeited', 'distributed')),
  created_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  UNIQUE(crew_id, user_id)
);
```

작업 목록:
```
[ ] crews 테이블에 track 컬럼 추가
[ ] deposits 테이블 생성 + RLS
[ ] 크루 생성 폼에 트랙 선택 UI 추가 (미션형/동업형 라디오)
[ ] 크루 목록/카드에 트랙 뱃지 표시
[ ] 수수료 로직 변경: entry_points → 인원수 기반 정액제 (6인 미만 3,000 / 6인 이상 5,000)
[ ] 크루 참여 시 보증금 예치 플로우 (지갑에서 차감 → deposits에 held 상태 기록)
```

---

##### STEP 4-2. 포인트 지갑 시스템 실체화

> 현재 wallet 페이지는 UI만 존재. 실제 포인트 잔액 관리가 필요.

```sql
-- 포인트 잔액 테이블
CREATE TABLE wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  balance INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 포인트 거래 내역
CREATE TABLE point_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount INT NOT NULL,            -- 양수: 충전/환급, 음수: 사용/몰수
  type TEXT NOT NULL CHECK (type IN (
    'charge', 'entry_fee', 'deposit_hold', 'deposit_refund',
    'deposit_forfeit', 'reward', 'gifticon_exchange'
  )),
  reference_id UUID,              -- 관련 crew_id 또는 deposit_id
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

작업 목록:
```
[ ] wallets, point_transactions 테이블 생성 + RLS
[ ] 회원가입 시 wallet 자동 생성 트리거
[ ] 포인트 충전 API (POST /api/wallet/charge)
[ ] 지갑 잔액 조회 API (GET /api/wallet)
[ ] 거래 내역 조회 API (GET /api/wallet/transactions)
[ ] wallet/page.tsx를 실제 DB 데이터로 연동
[ ] 크루 가입 시 수수료 자동 차감 로직 연결
```

---

#### Phase 5. Track A — 미션 달성형 핵심 기능

> 보증금 + 미션 인증 + 분배 로직. Track A의 완전한 사이클 구현.

##### STEP 5-1. 미션 인증샷 시스템

```
[ ] Supabase Storage 버킷 생성 (mission-verifications)
[ ] 미션 인증 테이블 생성:
    CREATE TABLE mission_verifications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      mission_id UUID NOT NULL REFERENCES missions(id),
      user_id UUID NOT NULL REFERENCES profiles(id),
      image_url TEXT NOT NULL,
      status TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
      verified_by UUID REFERENCES profiles(id),
      created_at TIMESTAMPTZ DEFAULT now()
    );
[ ] 인증샷 업로드 API (POST /api/missions/[id]/verify)
[ ] 크루장의 인증 승인/반려 API (PATCH /api/missions/[id]/verify/[verificationId])
[ ] missions 페이지에 카메라/갤러리 업로드 UI 추가
[ ] 인증 피드 (타임라인) 표시
```

##### STEP 5-2. 미션 성공률 계산 + 보증금 분배

```
[ ] 크루 종료(마감) API (POST /api/crews/[id]/close)
[ ] 성공률 계산 로직: (완료 미션 / 전체 미션) per user
[ ] 보증금 분배 알고리즘:
    - 100% 달성: 보증금 전액 환급
    - 부분 달성: 성공률 비례 환급
    - 실패: 보증금 → 크루장/플랫폼/우수 참여자에게 합의 비율대로 분배
[ ] 분배 비율 설정 UI (크루 생성 시 크루장이 미리 설정)
[ ] 분배 실행 시 point_transactions에 기록 + wallets 잔액 반영
[ ] 미션 데드라인 초과 시 자동 처리 로직 (API 호출 시 체크 또는 Supabase Edge Function)
```

---

#### Phase 6. Track B — 수익 분배형 핵심 기능

> 일일 투명 장부 시스템. 크루업의 핵심 차별 기술.

##### STEP 6-1. 일일 투명 장부 (Ledger System)

```sql
-- 장부 엔트리
CREATE TABLE ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crew_id UUID NOT NULL REFERENCES crews(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  revenue INT NOT NULL DEFAULT 0,       -- 당일 매출
  expense INT NOT NULL DEFAULT 0,       -- 당일 지출
  description TEXT,
  evidence_urls TEXT[] DEFAULT '{}',    -- 증빙 이미지 URLs
  created_by UUID NOT NULL REFERENCES profiles(id),
  is_locked BOOLEAN DEFAULT false,      -- 확정 시 true
  locked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(crew_id, date)                 -- 하루에 하나의 장부
);

-- 장부 동의 기록
CREATE TABLE ledger_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES ledger_entries(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  approved BOOLEAN NOT NULL DEFAULT false,
  approved_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(entry_id, user_id)
);

-- 장부 수정 이력 (운영자 중재용)
CREATE TABLE ledger_edit_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES ledger_entries(id),
  edited_by UUID NOT NULL REFERENCES profiles(id),
  reason TEXT NOT NULL,
  old_revenue INT,
  old_expense INT,
  new_revenue INT,
  new_expense INT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

작업 목록:
```
[ ] ledger_entries, ledger_approvals, ledger_edit_history 테이블 생성 + RLS
[ ] Supabase Storage 버킷 생성 (ledger-evidence)
[ ] 장부 작성 API (POST /api/crews/[id]/ledger) — 크루장만 가능
[ ] 장부 조회 API (GET /api/crews/[id]/ledger?from=&to=)
[ ] 증빙 업로드 API (POST /api/crews/[id]/ledger/[entryId]/evidence)
[ ] 장부 동의 API (POST /api/crews/[id]/ledger/[entryId]/approve)
[ ] 전원 동의 시 자동 잠금 (is_locked=true) 트리거 또는 API 로직
[ ] 잠긴 장부 수정 불가 RLS 정책 (is_locked=true일 때 UPDATE 차단)
```

##### STEP 6-2. 장부 UI 구현

```
[ ] /crews/[id]/ledger 페이지 신규 생성
    - 일자별 장부 리스트 (달력 또는 리스트 뷰)
    - 매출/지출 입력 폼 (크루장 전용)
    - 증빙 이미지 업로드 영역
    - 크루원별 [동의] 버튼 + 동의 현황 표시
    - 잠금 상태 뱃지 (확정됨 / 검토 중)
[ ] 대시보드에 장부 요약 위젯 추가 (총 매출, 총 지출, 순이익)
[ ] 면책 동의 모달: 장부 확정 시 "검토 소홀에 대한 책임은 확정 버튼을 누른 본인에게 귀속됨" 동의 필수
```

##### STEP 6-3. 정산서 발행 + P2P 안내

```
[ ] 정산 요약 API (GET /api/crews/[id]/settlement)
    - 기간별 총 매출/지출/순이익 집계
    - 합의된 분배 비율 적용한 인당 정산 금액 계산
[ ] 정산서 UI 페이지 (/crews/[id]/settlement)
    - 기간 선택
    - 멤버별 분배 금액 표
    - "이 정산서는 참고용이며, 실제 이체는 유저 간 직접 송금입니다" 안내 문구
[ ] 정산서 PDF/이미지 다운로드 (선택, html2canvas 또는 서버사이드 렌더링)
[ ] 크루 생성 시 수익 분배 비율 설정 UI (Track B 전용)
```

---

#### Phase 7. 리스크 매니지먼트 + 면책 시스템

> 사업 계획서의 Safety 항목 구현.

```
[ ] 7-1. 먹튀/잠적 방어
    - 진행률 50% 미만 시 보증금 인출 불가 로직
    - 크루 탈퇴 시 보증금 상태에 따른 분기 처리
    - 수사 협조 리포트 생성 (IP + 타임스탬프 로그 저장)

[ ] 7-2. 태만/데드라인 방어
    - 미션 데드라인 초과 감지 로직
    - 초과 시 시스템이 해당 미션 진행률 100%(완료) 강제 반영
    - 크루장에게 알림 (향후 알림 시스템과 연동)

[ ] 7-3. 면책 조항 시스템
    - 크루 가입 시 이용약관 + 면책 동의 체크박스
    - 장부 확정 시 면책 동의 강제 (6-2에서 구현)
    - 동의 기록 DB 저장 (법적 증거력 확보)

[ ] 7-4. 이용약관/개인정보처리방침 페이지
    - /terms, /privacy 페이지 작성
    - 플랫폼 포지션 명시: "기록은 플랫폼이, 책임은 유저가"
    - 세무/법무 면책 고지: "실제 소득세 신고 및 정산 책임은 유저에게 있음"
```

---

#### Phase 8. 수익화 + 부가 기능

> MVP 검증 후 매출 발생 기능 구현.

```
[ ] 8-1. 포인트 충전 결제 연동
    - 토스페이먼츠 또는 포트원(아임포트) API 연동
    - 충전 금액 선택 UI → 결제 → 포인트 적립
    - phase4-payment-plan.md 참고

[ ] 8-2. 기프티콘/상품권 교환
    - 외부 기프티콘 API 연동 (쿠프, 기프티스타 등)
    - 교환 수수료 부과 (매출원)
    - 교환 내역 point_transactions 기록

[ ] 8-3. 우수 크루장 시스템
    - 크루장 평점/완료율 기반 랭킹
    - 월간 우수 크루장 상금 (10만/5만/3만 포인트)
    - 유료 노출(AD) 시스템: 크루장이 포인트를 지불하여 크루 상단 노출

[ ] 8-4. 알림 시스템
    - 크루 참여 승인/반려 알림
    - 미션 데드라인 임박 알림
    - 장부 등록/동의 요청 알림
    - Supabase Realtime 또는 웹 푸시 활용
```

---

### 전체 로드맵 요약

```
Phase 3 (현재) ── 기본 CRUD + Auth + DB 적용
    ↓
Phase 4 ──────── 듀얼 트랙 구조 + 포인트 지갑 실체화
    ↓
Phase 5 ──────── Track A 완성 (미션 인증 + 보증금 분배)
    ↓
Phase 6 ──────── Track B 완성 (투명 장부 + 정산서)
    ↓
Phase 7 ──────── 리스크 방어 + 면책 시스템
    ↓
Phase 8 ──────── 수익화 (결제 + 기프티콘 + AD)
```

### 우선순위 판단 기준

1. **Phase 4는 필수 선행**: 트랙 구분 없이는 이후 모든 기능이 방향을 잃음
2. **Phase 5와 6은 병렬 가능**: Track A가 구현이 단순하므로 먼저 완성 권장
3. **Phase 7은 Phase 5-6과 함께 점진적 적용 가능**: 면책 조항은 빠를수록 좋음
4. **Phase 8은 유저 유입 후**: 결제 연동은 실제 사용자가 있을 때 의미 있음

### 현재 즉시 수정 가능한 항목 (코드 변경)

> Phase 3 완료 전이라도 미리 반영할 수 있는 구조적 변경들.

```
[ ] types/crew.ts에 track 필드 추가: track: 'mission' | 'revenue_share'
[ ] 크루 생성 폼(/crews/new)에 트랙 선택 라디오 버튼 추가
[ ] CrewCard에 트랙 뱃지 표시
[ ] 수수료 로직: entry_points 고정값 → 인원수 기반 정액 분기 (3,000/5,000)
[ ] 랜딩 페이지 가치 제안 문구를 듀얼 트랙에 맞게 수정
```

---
---

## 2026-03-11 | Anti-Gravity 작업 지시서 — 스프린트별 실행 계획

> 이 섹션은 anti-gravity(AI 코딩 도구)에 직접 전달할 수 있는 수준의 구체적 프롬프트로 구성됨.
> 각 스프린트는 2주 단위. 문서 참조 관계를 명확히 하여 중복 작업 방지.

### 문서 참조 맵

| 문서 | 역할 | 언제 참조 |
|------|------|-----------|
| `docs/schema.sql` | Phase 3 DB 스키마 (코어 3테이블) | Sprint 1 수동 적용 |
| `docs/next-steps.md` | 전체 로드맵 + 버그 목록 + 이 지시서 | 항상 |
| `docs/phase4-payment-plan.md` | Phase 4 DB/API/플로우 상세 설계 (단일 정답 문서) | Sprint 2~4 |
| `docs/auth-bugfix-plan.md` | BUG 1~10 수정 상세 | Sprint 1 |
| `docs/투명성_가이드라인.md` | Track B 장부 운영 원칙 | Sprint 4 |

---

### 현재 상태 진단

Phase 3 코드는 완성되었으나 **Supabase DB 스키마가 미적용**이라 모든 API가 동작하지 않는다.
코드 수준에서는 크루 CRUD, Auth, 미들웨어 보호, 채팅 인프라까지 구현됨.
Phase 4(포인트/에스크로)의 설계 문서(`phase4-payment-plan.md`)는 이미 상세하게 완성됨.
**차단 요소**: Supabase SQL Editor에서 `docs/schema.sql` 실행 한 번이 모든 것을 언블록한다.

---

### 작업 우선순위 매트릭스

| 우선순위 | 작업 | 긴급도 | 중요도 | 근거 |
|----------|------|--------|--------|------|
| P0 | DB 스키마 적용 (수동) | ★★★ | ★★★ | 이것 없이는 코드가 무용지물 |
| P1 | Phase 3 버그 수정 (BUG 1~10) | ★★★ | ★★ | 기본 플로우가 깨져있으면 이후 작업 불가 |
| P2 | 포인트 지갑 DB + API (Phase 4 Step 1) | ★★ | ★★★ | 에스크로/미션 배분의 전제 조건 |
| P3 | 에스크로 + 미션 인증 (Phase 4 Step 2) | ★★ | ★★★ | 핵심 비즈니스 로직 |
| P4 | 듀얼 트랙 구분 (track 필드) | ★ | ★★★ | Track A/B 분기의 기반이지만 UI 변경 수준 |
| P5 | 투명 장부 시스템 (Track B) | ★ | ★★★ | 핵심 차별 기능이나 복잡도 높음 |
| P6 | 결제 연동 (토스페이먼츠) | ★ | ★★ | 수동 충전으로 당분간 대체 가능 |
| P7 | 리스크 방어 + 면책 | ★ | ★★ | 법적 보호 필요하나 유저 유입 후에도 가능 |

---

### Sprint 1 (Week 1~2): Phase 3 완료 — DB 적용 + 버그 제거

**목표**: 회원가입 → 로그인 → 크루 생성 → 참여 신청까지 실제로 동작하는 MVP 코어 플로우 완성

**선행 조건 (사용자 수동 수행)**:
```
[ ] Supabase SQL Editor에서 docs/schema.sql 전체 실행
[ ] docs/next-steps.md의 handle_crew_created 트리거 SQL 실행
[ ] Supabase 대시보드에서 카카오/구글 OAuth provider 활성화
[ ] .env.local에 SUPABASE_URL, SUPABASE_ANON_KEY 확인
```

#### Anti-Gravity 프롬프트 #1: 타입 + 버그 수정
```
프로젝트: CrewUp (Next.js + Supabase)
참조 문서: docs/auth-bugfix-plan.md (BUG 1~10 전체)

작업 내용:
1. src/types/crew.ts에서 Crew.id 타입을 number → string으로 변경
2. docs/auth-bugfix-plan.md의 BUG 1~10을 순서대로 모두 수정
3. src/app/crews/page.tsx에서 <a> 태그를 next/link의 <Link>로 교체
4. SAMPLE_CREWS를 참조하는 모든 코드를 Supabase 직접 쿼리로 전환
5. ESLint any 타입 경고 8건 정리

완료 기준: npm run build 에러 0, ESLint 경고 0
```

#### Anti-Gravity 프롬프트 #2: 통합 테스트 + 핫픽스
```
프로젝트: CrewUp
전제: DB 스키마 적용 완료 상태

수동 테스트 시나리오를 순서대로 확인하고 실패하는 부분을 수정해줘:
1. 이메일 회원가입 → Supabase Users + profiles 자동 생성 확인
2. 로그인 → Header에 닉네임 표시 + 로그아웃 동작
3. /crews/new에서 크루 생성 → DB 저장 + 크루장 자동 등록
4. /crews에서 크루 목록 조회 + 카테고리/역할/검색 필터
5. /crews/[id]에서 크루 상세 + 멤버 정보 표시
6. 참여 신청 → crew_members pending 상태
7. 미인증 사용자가 보호 라우트 접근 시 /login 리다이렉트

각 단계에서 에러 발생 시 원인 분석 후 즉시 수정.
```

**Sprint 1 완료 기준**:
- [ ] 전체 플로우 (가입→로그인→크루생성→목록→상세→참여신청) 정상 동작
- [ ] npm run build 에러 0
- [ ] ESLint 경고 0

---

### Sprint 2 (Week 3~4): Phase 4 Step 1 — 포인트 지갑 + 크루 생성 고도화

**목표**: 포인트 잔액 관리가 실제로 동작하고, 크루 생성 시 미션/배분율을 설정할 수 있다

**참조 문서**: `docs/phase4-payment-plan.md` 섹션 3 (DB 스키마), 섹션 5 (UI), 섹션 7 Step 1

#### Anti-Gravity 프롬프트 #3: DB 스키마 확장 SQL 생성
```
프로젝트: CrewUp (Supabase PostgreSQL)
참조: docs/phase4-payment-plan.md 섹션 3 전체

아래 작업을 SQL 파일(docs/schema-phase4.sql)로 생성해줘:

1. crews 테이블에 컬럼 추가: entry_points, leader_margin_rate, mission_reward_rate
   - leader_margin_rate + mission_reward_rate <= 90 CHECK 제약
2. crew_members 테이블에 컬럼 추가: payment_status, approved_at, paid_at
   - payment_status DEFAULT 'unpaid', CHECK IN ('unpaid','paid','refunded')
3. user_points 테이블 생성 (balance, escrow_balance, total_earned)
   - RLS: 본인만 조회/수정
4. point_transactions 테이블 생성 (type, amount, balance_after, crew_id, mission_id)
   - RLS: 본인 거래만 조회
5. escrow_holds 테이블 생성
   - RLS: 본인 또는 해당 크루장만 조회
6. missions 테이블 생성 (crew_id, title, description, order_index, reward_points)
   - RLS: 조회 누구나, INSERT는 크루장만, UPDATE/DELETE 차단
7. mission_verifications 테이블 생성
   - RLS: 크루장만 INSERT
8. handle_new_user_wallet() 트리거: 회원가입 시 user_points 자동 생성

모든 테이블에 RLS ENABLE 필수. 기존 유저 backfill INSERT 포함.
```

#### Anti-Gravity 프롬프트 #4: 포인트 지갑 API + UI
```
프로젝트: CrewUp (Next.js App Router + Supabase)
참조: docs/phase4-payment-plan.md 섹션 6 (API 설계), 섹션 5-1 (월렛 UI)

구현할 것:

[API]
1. GET /api/wallet — 내 포인트 잔액 조회 (balance, escrow_balance, total_earned)
   - 파일: src/app/api/wallet/route.ts
   - 인증 필수, user_points 테이블에서 조회
2. GET /api/wallet/transactions — 거래 내역 (페이지네이션, 최신순)
   - 파일: src/app/api/wallet/transactions/route.ts
   - searchParams: page, limit (기본 20)

[UI]
3. src/app/wallet/page.tsx 전면 재작성:
   - 상단: 포인트 잔액 카드 (사용 가능 / 에스크로 중 / 누적 리워드)
   - 중단: 거래 내역 리스트 (날짜, 종류 아이콘, 금액 +/-, 거래 후 잔액)
   - 하단: "충전" 버튼 (현재는 비활성 — "준비 중" 표시)
   - 모바일 퍼스트, Tailwind CSS

기존 wallet/page.tsx를 읽고 활용 가능한 UI는 유지하되, 하드코딩된 데이터를 API 호출로 교체.
```

#### Anti-Gravity 프롬프트 #5: 크루 생성 폼 고도화
```
프로젝트: CrewUp
참조: docs/phase4-payment-plan.md 섹션 4-2 (크루 생성 플로우), 섹션 5-2 (UI)

현재 파일: src/app/crews/new/page.tsx
현재 API: src/app/api/crews/route.ts (POST)

수정할 것:

[크루 생성 폼 추가 필드]
1. 참여 포인트 입력 (entry_points): 숫자 입력, 0이면 무료 크루
2. 크루장 수익 배분율 (leader_margin_rate): 슬라이더 또는 숫자 입력 (0~90%)
3. 크루원 리워드 배분율 (mission_reward_rate): 슬라이더 또는 숫자 입력
4. 실시간 합산 검증: leader + mission <= 90%, 나머지가 플랫폼 수수료임을 표시
5. 미션 입력: 각 미션에 리워드 포인트(reward_points) 필드 추가
6. "생성 후 미션 변경 불가" 경고 문구
7. 최종 확인 모달 (모든 설정 요약 → "이대로 생성" 버튼)

[API 수정]
8. POST /api/crews body에 entry_points, leader_margin_rate, mission_reward_rate, missions[] 추가
9. 서버 검증: 배분율 합산 <= 90, missions 최소 1개
10. crews INSERT + missions INSERT를 트랜잭션으로 처리

주의: 포인트 이동 로직은 이 단계에서 구현하지 않음. 크루 메타데이터 저장만.
```

**Sprint 2 완료 기준**:
- [ ] /wallet에서 실제 DB 기반 포인트 잔액 표시
- [ ] 크루 생성 시 미션 + 배분율 설정이 DB에 정상 저장
- [ ] SQL 수동 충전 후 /wallet 잔액 표시 확인

---

### Sprint 3 (Week 5~6): Phase 4 Step 2 — 에스크로 + 미션 인증 + 배분

**목표**: 참여 승인 → 포인트 에스크로 → 미션 인증 → 자동 배분의 전체 사이클이 동작

**참조 문서**: `docs/phase4-payment-plan.md` 섹션 3-3 (PostgreSQL 함수), 섹션 4-3~4-6 (플로우), 섹션 7 Step 2

#### Anti-Gravity 프롬프트 #6: PostgreSQL 함수 (핵심 비즈니스 로직)
```
프로젝트: CrewUp (Supabase PostgreSQL)
참조: docs/phase4-payment-plan.md 섹션 3-3, 4-3, 4-4, 4-5, 4-6

중요: 모든 포인트 이동은 반드시 PostgreSQL 함수(RPC) 내에서 처리.
Next.js API에서 direct UPDATE로 잔액을 변경하면 안 됨.

구현할 PostgreSQL 함수 3개:

1. process_entry_payment(p_crew_member_id UUID)
   - crew_members에서 crew_id, user_id 조회
   - crews에서 entry_points 조회
   - user_points.balance >= entry_points 확인 (부족 시 RAISE EXCEPTION)
   - user_points.balance -= entry_points
   - user_points.escrow_balance += entry_points
   - escrow_holds INSERT (status: 'holding', amount: entry_points)
   - point_transactions INSERT (type: 'entry_payment', amount: -entry_points, balance_after 계산)
   - crew_members UPDATE (payment_status: 'paid', paid_at: now())
   - 전체를 하나의 트랜잭션으로 처리

2. distribute_mission_reward(p_verification_id UUID)
   - mission_verifications → crew_id, mission_id 조회
   - crews → leader_margin_rate, mission_reward_rate 조회
   - active 크루원 목록 + 각 escrow_holds 조회
   - 배분 계산:
     * 플랫폼 수수료 = 크루원별_entry_points * 10%
     * 크루장 마진 = 크루원별_entry_points * leader_margin_rate%
     * 크루원 리워드 = missions.reward_points (미션 테이블에서)
   - 소수점 처리: FLOOR, 나머지는 크루장에게 귀속
   - 각 크루원: escrow_balance 차감, total_earned += reward
   - 크루장: balance += leader_margin
   - point_transactions 다건 INSERT
   - escrow_holds.released_amount 업데이트
   - mission_verifications.distribution_status = 'completed'

3. process_full_refund(p_crew_id UUID)
   - 해당 크루 escrow_holds (status != 'refunded') 전체 조회
   - 각 크루원: 미배분 잔액 = amount - released_amount
   - user_points.balance += 미배분 잔액
   - user_points.escrow_balance -= 미배분 잔액
   - escrow_holds.status = 'refunded'
   - point_transactions INSERT (type: 'refund')

파일: docs/schema-phase4-functions.sql로 생성
```

#### Anti-Gravity 프롬프트 #7: 승인/인증/탈퇴/해산 API
```
프로젝트: CrewUp (Next.js App Router)
참조: docs/phase4-payment-plan.md 섹션 6 (API 설계)

구현할 API 4개:

1. POST /api/crews/[id]/approve/[memberId]
   - 파일: src/app/api/crews/[id]/approve/[memberId]/route.ts
   - 크루장 권한 확인 (crews.created_by === 현재 유저)
   - 정원 초과 확인
   - supabase.rpc('process_entry_payment', { p_crew_member_id: memberId }) 호출
   - 포인트 부족 에러 시 400 + 한국어 메시지

2. POST /api/crews/[id]/missions/[missionId]/verify
   - 파일: src/app/api/crews/[id]/missions/[missionId]/verify/route.ts
   - 크루장 권한 확인
   - 이미 인증된 미션 중복 차단
   - mission_verifications INSERT
   - supabase.rpc('distribute_mission_reward', { p_verification_id }) 호출

3. POST /api/crews/[id]/leave
   - 파일: src/app/api/crews/[id]/leave/route.ts
   - body에 confirm: true 필수 (실수 방지)
   - escrow_holds.status = 'forfeited'
   - crew_members.status = 'left'
   - point_transactions INSERT

4. POST /api/crews/[id]/disband
   - 파일: src/app/api/crews/[id]/disband/route.ts
   - 크루장 권한 확인
   - supabase.rpc('process_full_refund', { p_crew_id: id }) 호출
   - crews.status = 'disbanded'
   - crew_members 전원 상태 변경
```

#### Anti-Gravity 프롬프트 #8: 대시보드 UI 고도화
```
프로젝트: CrewUp
현재 파일: src/app/crews/[id]/dashboard/page.tsx

대시보드에 다음 섹션을 추가/수정해줘:

1. [참여 신청 관리] 섹션
   - 신청자 목록 (닉네임, 포인트 잔액 표시)
   - "승인" 버튼 → POST /api/crews/[id]/approve/[memberId] 호출
   - 포인트 부족 시 "잔액 부족" 경고 표시
   - "거절" 버튼 → crew_members.status = 'rejected' UPDATE

2. [미션 인증] 섹션
   - 미션 목록 (순서대로, 인증 여부 상태 표시)
   - 미인증 미션에 "인증 처리" 버튼 + 확인 모달
   - 인증 완료 후 에스크로 배분 결과 표시

3. [에스크로 현황] 섹션
   - 총 예치액 / 배분 완료액 / 잔여 에스크로
   - 크루원별 예치 상태 표

4. [위험 영역] 섹션 (하단, 빨간색 계열)
   - "크루 해산" 버튼 + "해산 시 전원 환급됩니다" 경고 모달
   - POST /api/crews/[id]/disband 호출

모바일 퍼스트, Tailwind CSS. 각 섹션에 로딩/빈 상태 처리 포함.
```

**Sprint 3 완료 기준**:
- [ ] 테스트: 참여 신청 → 승인 → 에스크로 예치 확인 (포인트 차감됨)
- [ ] 테스트: 미션 인증 → 배분 계산 정확 (소수점 나머지 크루장 귀속)
- [ ] 테스트: 자발적 탈퇴 → 에스크로 몰수
- [ ] 테스트: 크루장 해산 → 전액 환급
- [ ] 포인트 정합성: balance + escrow_balance 항상 일치

---

### Sprint 4 (Week 7~8): 듀얼 트랙 분기 + Track B 장부 시스템

**목표**: Track A/B 구분이 UI에 반영되고, Track B의 일일 투명 장부 MVP가 동작

#### Anti-Gravity 프롬프트 #9: 듀얼 트랙 구분
```
프로젝트: CrewUp
참조: 이 파일(next-steps.md)의 "사업 계획서 점검" 섹션

작업:
1. src/types/crew.ts에 track 필드 추가: track: 'mission' | 'revenue_share'
2. crews 테이블에 track 컬럼 추가 SQL 생성
3. src/app/crews/new/page.tsx에 트랙 선택 UI 추가:
   - "미션 달성형": 보증금 걸고 미션 수행, 성공률 기반 보상
   - "수익 분배형": 실제 사업 수익을 장부로 기록하고 분배
   - 트랙에 따라 하위 폼 필드가 달라짐:
     * mission: 미션 설정 + 보증금 + 배분율
     * revenue_share: 수익 분배 비율 + 장부 운영 동의
4. src/components/CrewCard.tsx에 트랙 뱃지 추가
5. src/app/crews/page.tsx 필터에 트랙 필터 추가
6. 크루 상세 페이지에서 트랙에 따라 다른 탭 표시:
   - mission: 미션 탭
   - revenue_share: 장부 탭 + 정산 탭

수수료 로직도 변경:
- 기존 entry_points (자유 설정) → 인원수 기반 정액제
- 6인 미만: 인당 3,000 포인트
- 6인 이상: 인당 5,000 포인트
- max_members 기준으로 자동 계산, 사용자 수정 불가
```

#### Anti-Gravity 프롬프트 #10: 일일 투명 장부 (Track B 핵심)
```
프로젝트: CrewUp
참조: docs/투명성_가이드라인.md, 이 파일의 Phase 6 섹션

Track B (수익 분배형) 크루 전용 일일 투명 장부 시스템 구현.

[DB — docs/schema-ledger.sql 생성]
1. ledger_entries 테이블 (crew_id, date, revenue, expense, description, evidence_urls[], is_locked, locked_at)
   - UNIQUE(crew_id, date): 하루에 하나
   - RLS: 해당 크루 멤버만 조회, 크루장만 INSERT, is_locked=true면 UPDATE 차단
2. ledger_approvals 테이블 (entry_id, user_id, approved, approved_at)
   - UNIQUE(entry_id, user_id)
3. ledger_edit_history 테이블 (entry_id, edited_by, reason, old/new_revenue, old/new_expense)

[API]
4. POST /api/crews/[id]/ledger — 장부 작성 (크루장 전용)
   - body: { date, revenue, expense, description }
5. GET /api/crews/[id]/ledger — 장부 목록 조회
   - searchParams: from, to (날짜 범위)
6. POST /api/crews/[id]/ledger/[entryId]/approve — 크루원 동의
   - 전원 동의 시 자동으로 is_locked=true + locked_at 설정
7. POST /api/crews/[id]/ledger/[entryId]/evidence — 증빙 이미지 업로드
   - Supabase Storage (ledger-evidence 버킷) 사용

[UI — /crews/[id]/ledger 페이지 신규]
8. 일자별 장부 리스트 (리스트 뷰, 날짜 내림차순)
   - 각 엔트리: 날짜 | 매출 | 지출 | 순이익 | 상태(검토중/확정)
9. 장부 작성 폼 (크루장만 표시): 매출/지출/설명 입력 + 증빙 이미지 첨부
10. 크루원별 [동의] 버튼 + 동의 현황 (O/X 아이콘)
11. 잠금된 장부는 자물쇠 아이콘 + 수정 불가 표시
12. 면책 동의 모달: [동의] 클릭 시 "검토 소홀에 대한 책임은 확정 버튼을 누른 본인에게 귀속됩니다" 체크박스 필수

주의: 잠긴 장부의 수정은 이 스프린트에서 구현하지 않음 (운영자 중재는 추후).
```

**Sprint 4 완료 기준**:
- [ ] 크루 생성 시 트랙(미션형/수익분배형) 선택 가능
- [ ] 크루 목록/카드에 트랙 뱃지 표시
- [ ] Track B 크루에서 장부 작성 → 크루원 동의 → 자동 잠금 플로우 동작
- [ ] 잠긴 장부 수정 불가 확인
- [ ] 수수료가 인원수 기반으로 자동 계산됨

---

### 기술적 의사결정 필요 사항

| # | 질문 | 추천안 | 결정 상태 |
|---|------|--------|-----------|
| 1 | 포인트 이동 방식 | PostgreSQL 함수(RPC) 필수 — direct UPDATE 금지 | 확정 |
| 2 | 증빙 이미지 저장소 | Supabase Storage (무료 1GB) | 확정 |
| 3 | 장부 잠금 방식 | RLS에서 is_locked=true면 UPDATE 차단 | 확정 |
| 4 | 결제 연동 시점 | Sprint 5 이후 (수동 충전으로 당분간 대체) | 확정 |
| 5 | Track A/B DB 분리 여부 | 분리 안 함. crews.track 컬럼으로 분기 | 확정 |
| 6 | 장부 수정 중재 (운영자) | Sprint 5 이후 (관리자 패널과 함께) | 보류 |
| 7 | 정산서 PDF 생성 방식 | html2canvas vs 서버사이드 | 미결정 |

---

### Anti-Gravity 사용 시 주의사항

1. **포인트 정합성**: 포인트 이동 코드를 생성할 때 "Supabase RPC를 호출하라"고 명시. API Route에서 직접 `UPDATE user_points SET balance = ...` 하면 경합 조건(race condition) 발생 가능.

2. **phase4-payment-plan.md가 단일 정답 문서**: Sprint 2~3에서 DB 스키마나 API를 구현할 때 이 문서를 반드시 참조하라고 프롬프트에 명시. 여러 문서에 중복 설계가 있으므로 phase4 문서가 우선.

3. **트랜잭션 보장**: crews + missions 동시 INSERT, 에스크로 이동 등 원자성이 필요한 작업은 PostgreSQL 함수 안에서 처리. Supabase JS SDK의 `.rpc()` 메서드 사용.

4. **RLS 정책 테스트**: 새 테이블마다 RLS가 제대로 걸렸는지 확인. `ENABLE ROW LEVEL SECURITY` 누락 시 데이터 노출 위험.

5. **기존 코드 참조 지시**: anti-gravity에게 새 파일을 만들기 전에 "기존 src/app/api/crews/route.ts 패턴을 따라라"고 지시. 인증 확인, 에러 핸들링 패턴이 이미 잡혀있음.

6. **한국어 UI**: 모든 사용자 대면 텍스트는 한국어. 에러 메시지, 버튼 텍스트, 안내 문구 모두.

---

### 전체 타임라인 요약

```
Sprint 1 (W1~2)  ── Phase 3 완료: DB 적용 + 버그 수정 + 통합 테스트
                     └─ 여기서 MVP 코어 플로우가 처음으로 "실제 동작"
    ↓
Sprint 2 (W3~4)  ── Phase 4 Step 1: 포인트 지갑 + 크루 생성 고도화
                     └─ 포인트 잔액이 실제로 표시되고, 미션/배분율 설정 가능
    ↓
Sprint 3 (W5~6)  ── Phase 4 Step 2: 에스크로 + 미션 인증 + 자동 배분
                     └─ 돈이 흐르는 핵심 로직 완성
    ↓
Sprint 4 (W7~8)  ── 듀얼 트랙 분기 + Track B 장부 MVP
                     └─ 크루업만의 차별 기능 탑재
    ↓
Sprint 5+ (이후)  ── 결제 연동 + 리스크 방어 + 면책 + 우수 크루장 + AD
```
