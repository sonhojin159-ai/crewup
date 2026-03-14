# Phase 4 — 결제 & 포인트 시스템 작업계획서

> 작성일: 2026-03-11
> 전제: Phase 3 (DB 스키마 적용 + 코어 API + 인증) 완료 후 진입

---

## 1. 개요 및 목표

### 1-1. 배경

Phase 3까지 완성된 것: 크루 생성 / 탐색 / 참여 신청 / 승인 플로우 (포인트 없이)

Phase 4에서 추가하는 것: **포인트 기반 참여금 + 에스크로 + 미션 완료 시 자동 배분**

사용자가 크루에 참여할 때 포인트를 예치하고, 미션을 완료할 때마다 에스크로에서 단계별로 배분받는 구조를 구현한다.

### 1-2. 핵심 목표

- 사용자가 포인트 잔액을 보유하고, 크루 참여 시 해당 포인트로 참여금을 결제할 수 있다
- 결제된 포인트는 에스크로에 보관되고, 미션 완료 시마다 자동 배분된다
- 플랫폼 수수료 10%는 배분 시점에 선공제된다
- 크루장 귀책 해산 시 전액 환급, 자발적 탈퇴 시 환급 없음

### 1-3. 구현 전략 (3단계 점진적 접근)

| 단계 | 범위 | 목적 |
|------|------|------|
| Step 1 | 포인트 지갑 + 수동 충전 | 지갑 구조 및 UI 검증 |
| Step 2 | 에스크로 로직 + 미션 배분 | 포인트 내부 이동 로직 검증 |
| Step 3 | 토스페이먼츠 결제 연동 | 실제 현금 → 포인트 충전 |

---

## 2. 확정된 비즈니스 정책

| 항목 | 정책 |
|------|------|
| 포인트 비율 | 1원 = 1포인트 |
| 플랫폼 수수료 | 배분 시점에 10% 선공제 |
| 결제 시점 | 크루장 승인 후 즉시 결제 (거절 시 결제 없음) |
| 크루원 자발적 탈퇴 | 포인트 환급 없음 (에스크로 포인트 플랫폼 귀속) |
| 크루장 귀책 해산 | 크루원 전원에게 에스크로 포인트 전액 환급 |
| 리워드 사용처 | 기프티콘 교환만 가능 (현금화 불가) |
| 미션 인증 권한 | 크루장 단독 인증 |
| 미션 변경 | 크루 생성 시 1회 설정, 이후 변경 불가 |
| 미션 공개 시점 | 크루 탐색 페이지에서 가입 전 확인 가능 |

---

## 3. DB 스키마 설계

### 3-1. 기존 테이블 변경

#### `crews` 테이블 — 컬럼 추가

| 추가 컬럼 | 타입 | 설명 |
|-----------|------|------|
| `entry_points` | INTEGER NOT NULL DEFAULT 0 | 참여금 (포인트) |
| `leader_margin_rate` | NUMERIC(5,2) NOT NULL DEFAULT 0 | 크루장 수익 배분율 (%) |
| `mission_reward_rate` | NUMERIC(5,2) NOT NULL DEFAULT 0 | 미션 리워드 배분율 (%) |

> 제약: `leader_margin_rate + mission_reward_rate <= 90` (나머지 10%는 플랫폼)
> 크루 생성 후 변경 불가 (UPDATE 제한 또는 트리거로 보호)

#### `crew_members` 테이블 — 컬럼 추가

| 추가 컬럼 | 타입 | 설명 |
|-----------|------|------|
| `payment_status` | TEXT | `unpaid` / `paid` / `refunded` |
| `approved_at` | TIMESTAMPTZ | 크루장 승인 시각 |
| `paid_at` | TIMESTAMPTZ | 참여금 결제 시각 |

### 3-2. 신규 테이블

#### `user_points` — 사용자 포인트 지갑

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | UUID PK | |
| `user_id` | UUID FK → profiles.id | UNIQUE |
| `balance` | INTEGER NOT NULL DEFAULT 0 | 사용 가능 잔액 |
| `escrow_balance` | INTEGER NOT NULL DEFAULT 0 | 에스크로 중인 잔액 (출금 불가) |
| `total_earned` | INTEGER NOT NULL DEFAULT 0 | 누적 리워드 수령액 |
| `updated_at` | TIMESTAMPTZ | |

> 유저 생성 시 자동으로 레코드 생성 (트리거)

#### `point_transactions` — 포인트 입출금 내역

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | UUID PK | |
| `user_id` | UUID FK → profiles.id | |
| `type` | TEXT | `charge` / `entry_payment` / `escrow_release` / `refund` / `platform_fee` / `reward` |
| `amount` | INTEGER NOT NULL | 양수: 입금, 음수: 출금 |
| `balance_after` | INTEGER NOT NULL | 거래 후 잔액 (감사 추적용) |
| `crew_id` | UUID FK → crews.id NULLABLE | 관련 크루 |
| `mission_id` | UUID FK → missions.id NULLABLE | 관련 미션 |
| `note` | TEXT | 사람이 읽을 수 있는 설명 |
| `created_at` | TIMESTAMPTZ | |

#### `escrow_holds` — 에스크로 보관 내역

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | UUID PK | |
| `crew_id` | UUID FK → crews.id | |
| `member_user_id` | UUID FK → profiles.id | 포인트를 예치한 크루원 |
| `amount` | INTEGER NOT NULL | 예치 원금 |
| `released_amount` | INTEGER NOT NULL DEFAULT 0 | 지금까지 배분된 누적액 |
| `status` | TEXT | `holding` / `partially_released` / `fully_released` / `refunded` |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

#### `missions` — 크루 미션 목록

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | UUID PK | |
| `crew_id` | UUID FK → crews.id ON DELETE CASCADE | |
| `title` | TEXT NOT NULL | 미션 제목 |
| `description` | TEXT | 미션 상세 설명 |
| `order_index` | INTEGER NOT NULL | 미션 순서 (1부터 시작) |
| `reward_points` | INTEGER NOT NULL DEFAULT 0 | 이 미션 완료 시 지급할 리워드 (크루원 1인당) |
| `created_at` | TIMESTAMPTZ | |

> 크루 생성과 동시에 INSERT됨. 이후 UPDATE / DELETE 불가 (RLS 또는 트리거로 강제)

#### `mission_verifications` — 미션 인증 내역

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | UUID PK | |
| `mission_id` | UUID FK → missions.id | |
| `crew_id` | UUID FK → crews.id | 조회 편의용 |
| `verified_by` | UUID FK → profiles.id | 인증한 크루장 |
| `verified_at` | TIMESTAMPTZ DEFAULT now() | |
| `distribution_status` | TEXT | `pending` / `completed` / `failed` |
| `note` | TEXT NULLABLE | 인증 메모 |

#### `reward_redemptions` — 리워드 교환 내역 (Phase 4 후반)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | UUID PK | |
| `user_id` | UUID FK → profiles.id | |
| `item_name` | TEXT NOT NULL | 교환 기프티콘 명 |
| `points_used` | INTEGER NOT NULL | 차감 포인트 |
| `status` | TEXT | `requested` / `processing` / `completed` / `failed` |
| `created_at` | TIMESTAMPTZ | |

### 3-3. PostgreSQL 함수 (서버 로직)

> 상세 SQL은 구현 단계에서 작성. 아래는 함수 목록과 역할만 정의.

| 함수명 | 역할 | 호출 시점 |
|--------|------|-----------|
| `handle_new_user_wallet()` | user_points 레코드 자동 생성 | auth.users INSERT 트리거 |
| `process_entry_payment(member_id, crew_id)` | 참여금 차감 + 에스크로 이동 원자적 처리 | 크루장 승인 시 API에서 호출 |
| `distribute_mission_reward(mission_verification_id)` | 미션 완료 시 에스크로 → 크루원 리워드 + 크루장 마진 배분 (수수료 10% 공제) | 미션 인증 등록 시 API에서 호출 |
| `process_full_refund(crew_id)` | 크루장 귀책 해산 시 모든 escrow_holds 전액 환급 | 크루 강제 해산 API에서 호출 |

> 모든 포인트 이동은 트랜잭션으로 처리. 중간 실패 시 롤백 보장.

---

## 4. 플로우 상세 설계

### 4-1. 포인트 충전 플로우

```
[Step 1] 수동 충전 (관리자가 SQL로 직접 부여 — 구조 검증용)
[Step 3] 토스페이먼츠 연동 후 자동화

사용자 → 충전 금액 입력 → 토스페이먼츠 결제 → 결제 성공 콜백
→ /api/payments/confirm POST (서버에서 토스 서버와 검증)
→ user_points.balance += amount
→ point_transactions INSERT (type: 'charge')
→ 마이 월렛 잔액 갱신
```

**예외 처리:**
- 결제 성공 콜백이 왔으나 DB INSERT 실패 → 토스 결제 취소 API 호출 후 롤백
- 동일 결제 ID 중복 처리 방지 (idempotency key)

### 4-2. 크루 생성 플로우 (포인트 설계 + 미션 설정 포함)

```
크루장 → /crews/new 접속
→ 기본 정보 입력 (카테고리, 제목, 설명, 인원 등) [기존]
→ 포인트 설계 입력:
   - 참여 포인트 (entry_points): 크루원이 내야 할 참여금
   - 크루장 수익 배분율 (leader_margin_rate): 미션 완료 시 크루장에게 가는 비율
   - 미션 리워드 배분율 (mission_reward_rate): 미션 완료 시 크루원에게 가는 비율
   - 합산이 90%를 넘지 않도록 실시간 유효성 검사 (나머지 10% 플랫폼)
→ 미션 설정 입력:
   - 미션 제목 / 설명 / 리워드 포인트 (1개 이상 필수)
   - "생성 후 미션 변경 불가" 안내 문구 명시
→ 최종 확인 모달 (설정 값 요약 + "확인 후 생성" 버튼)
→ POST /api/crews (crews + missions 동시 INSERT, 트랜잭션)
→ 크루 상세 페이지 이동
```

**예외 처리:**
- crews INSERT 성공 + missions INSERT 실패 → 전체 롤백 (트랜잭션 필수)
- leader_margin_rate + mission_reward_rate > 90 → 서버에서도 검증

### 4-3. 크루 참여 플로우 (신청 → 승인 → 결제 → active)

```
크루원 → /crews/[id] 접속 → 미션 목록 및 참여 포인트 확인 (가입 전 공개)
→ "참여 신청하기" 클릭
  → 잔액 부족 시 "포인트 충전 후 신청 가능" 안내 (신청 자체는 가능 — 옵션 A)
  → 또는 잔액 확인 후 신청 차단 (옵션 B)  ← 정책 미결정 (사용자 판단 필요)
→ crew_members INSERT (status: 'pending', payment_status: 'unpaid')

크루장 → 대시보드에서 신청 목록 확인
→ "승인" 클릭
→ process_entry_payment() 함수 호출:
   - 크루원 user_points.balance -= entry_points
   - user_points.escrow_balance += entry_points
   - escrow_holds INSERT (status: 'holding')
   - point_transactions INSERT (type: 'entry_payment', amount: -entry_points)
→ crew_members UPDATE (status: 'active', payment_status: 'paid', approved_at: now())

크루원 → 마이 월렛에서 "에스크로 중" 금액 확인 가능
```

**예외 처리:**
- 승인 시점에 크루원 포인트 잔액 부족 → 승인 실패, 크루장에게 안내
- 승인 시점에 크루 정원 초과 → 승인 차단

### 4-4. 미션 인증 → 에스크로 정산 플로우

```
크루장 → 크루 대시보드 → 미션 목록
→ 특정 미션 "인증 처리" 클릭
→ 인증 메모 입력 (선택)
→ mission_verifications INSERT
→ distribute_mission_reward() 함수 호출:

   [배분 계산 예시]
   entry_points = 10,000P, 크루원 5명, leader_margin_rate = 20%, mission_reward_rate = 50%
   수수료 = 10,000 × 5 × 10% = 5,000P (플랫폼)
   크루장 수익 = 10,000 × 5 × 20% = 10,000P
   크루원 1인 리워드 = 10,000 × 50% = 5,000P (미션 1개 기준)

   → 크루원 각각: escrow_balance 일부 차감 + total_earned += reward_points
   → 크루장: user_points.balance += leader_margin (에스크로 아님, 즉시 사용 가능)
   → 플랫폼: 별도 platform_revenue 테이블 또는 관리자 계정에 기록
   → point_transactions INSERT (type: 'reward' — 크루원, type: 'escrow_release' — 크루장)
   → escrow_holds.released_amount 갱신

→ 미션 인증 완료 알림 (크루 채팅 또는 알림)
```

**예외 처리:**
- 이미 인증된 미션 재인증 시도 → 차단 (mission_verifications UNIQUE 제약)
- 배분 계산 중 오류 → 트랜잭션 롤백, distribution_status: 'failed' 기록

### 4-5. 크루장 귀책 해산 → 전액 환급 플로우

```
크루장 → 크루 대시보드 → "크루 해산" (귀책 사유 포함)
→ 또는 관리자 강제 해산

→ process_full_refund(crew_id) 함수 호출:
   - 해당 크루의 escrow_holds WHERE status = 'holding' OR 'partially_released' 조회
   - 각 크루원별로: 미배분 잔액(amount - released_amount) 환급
   - user_points.balance += 환급액
   - user_points.escrow_balance -= 환급액
   - escrow_holds.status = 'refunded'
   - point_transactions INSERT (type: 'refund')

→ crew_members 전원 status = 'disbanded'
→ crews.status = 'disbanded'
→ 각 크루원에게 환급 알림
```

**예외 처리:**
- 이미 부분 배분된 경우 → 미배분 잔액만 환급 (전체 기록 대조 필수)
- 환급 처리 중 일부 실패 → 실패한 건만 재시도 큐에 등록 (향후 구현)

### 4-6. 크루원 자발적 탈퇴 → 환급 없음 플로우

```
크루원 → 크루 상세 페이지 → "크루 탈퇴"
→ "탈퇴 시 참여금은 환급되지 않습니다" 확인 모달
→ 사용자 확인

→ escrow_holds.status = 'forfeited' (몰수 처리)
→ 플랫폼 귀속 처리 (platform_revenue 기록 또는 관리자 wallet 이동)
→ crew_members.status = 'left'
→ point_transactions INSERT (type: 'forfeiture', amount: 0, note: '자발적 탈퇴 — 환급 없음')
```

**예외 처리:**
- active 상태가 아닌 크루원(pending 상태)의 탈퇴 → 결제 전이므로 단순 취소 (환급 이슈 없음)
- 이미 fully_released된 에스크로는 탈퇴와 무관

---

## 5. UI 화면 구성

### 5-1. 마이 월렛 페이지 (`/wallet`)

**현재 상태:** 페이지 파일 존재, 내용 미구현

**구현할 섹션:**

| 섹션 | 표시 내용 |
|------|-----------|
| 포인트 잔액 요약 | 사용 가능 잔액 / 에스크로 중 잔액 / 누적 리워드 수령액 |
| 충전 버튼 | Step 1: "충전 요청 (준비 중)" / Step 3: 토스페이먼츠 결제 |
| 거래 내역 | 날짜 / 종류 / 금액 / 잔액 (최신순, 페이지네이션) |
| 에스크로 현황 | 참여 중인 크루별 예치 금액 및 배분 진행 상황 |
| 리워드 내역 | 미션별 수령 리워드 내역 |

### 5-2. 크루 생성 페이지 (`/crews/new`) — 추가 섹션

**현재 상태:** 기본 정보 + 미션 입력 UI 존재, API 미연동

**추가할 섹션:**

| 섹션 | 구성 |
|------|------|
| 참여 포인트 설정 | 숫자 입력 (0 입력 시 무료 크루) |
| 수익 배분 설계 | 크루장 수익율 + 크루원 리워드율 슬라이더 + 플랫폼 10% 표시 + 합산 검증 |
| 미션 목록 설정 | 미션 추가/삭제 (최소 1개) + 각 미션별 리워드 포인트 입력 |
| 미션 변경 불가 안내 | "생성 후 미션 내용은 수정할 수 없습니다" 강조 표시 |
| 최종 확인 | 모든 설정값 요약 카드 + "이대로 크루 생성" 버튼 |

### 5-3. 크루 상세 페이지 (`/crews/[id]`) — 정보 추가

| 추가 표시 항목 | 위치 |
|----------------|------|
| 참여 포인트 금액 | 크루 기본 정보 영역 |
| 수익 배분 구조 (크루장/크루원/플랫폼 비율) | 크루 기본 정보 영역 |
| 미션 목록 및 미션별 리워드 | 미션 탭 (가입 전 공개) |

### 5-4. 크루 대시보드 — 크루장 전용 (`/crews/[id]/dashboard`)

**추가할 탭/섹션:**

| 섹션 | 내용 |
|------|------|
| 에스크로 현황 | 총 예치액 / 배분된 액수 / 잔여 에스크로 |
| 미션 인증 | 미션별 "인증 처리" 버튼 + 인증 일시 표시 |
| 참여 신청 관리 | 신청자 목록 + 포인트 잔액 표시 + 승인/거절 버튼 |
| 크루 해산 | 하단 위험 영역에 "귀책 해산" 버튼 (강조된 경고 UI) |

---

## 6. API 설계

| 메서드 | 경로 | 설명 | 인증 |
|--------|------|------|------|
| GET | `/api/wallet` | 내 포인트 잔액 + 에스크로 현황 조회 | 필수 |
| GET | `/api/wallet/transactions` | 거래 내역 목록 (페이지네이션) | 필수 |
| POST | `/api/wallet/charge` | Step 1: 수동 충전 요청 / Step 3: 토스 결제 시작 | 필수 |
| POST | `/api/payments/confirm` | 토스페이먼츠 결제 확인 콜백 처리 | 필수 |
| POST | `/api/crews` | 크루 생성 (missions 동시 INSERT 포함) | 필수 |
| POST | `/api/crews/[id]/approve/[memberId]` | 크루원 승인 + 참여금 결제 트리거 | 크루장 |
| POST | `/api/crews/[id]/missions/[missionId]/verify` | 미션 인증 + 배분 트리거 | 크루장 |
| POST | `/api/crews/[id]/leave` | 크루 자발적 탈퇴 (환급 없음) | 크루원 |
| POST | `/api/crews/[id]/disband` | 크루 귀책 해산 (전액 환급) | 크루장 |
| GET | `/api/rewards/items` | 교환 가능 기프티콘 목록 | 필수 |
| POST | `/api/rewards/redeem` | 기프티콘 교환 신청 | 필수 |

---

## 7. Step별 구체적 작업 체크리스트

### Step 1 — 포인트 지갑 (수동 충전으로 구조 검증)

**목표:** 실제 결제 없이 포인트 지갑의 DB 구조와 UI를 검증한다.

#### 1-A. DB 스키마 추가 (Supabase SQL Editor)

```
[ ] 1-A-1. crews 테이블에 entry_points, leader_margin_rate, mission_reward_rate 컬럼 추가
[ ] 1-A-2. crew_members 테이블에 payment_status, approved_at, paid_at 컬럼 추가
[ ] 1-A-3. user_points 테이블 생성 + RLS 정책 (본인만 조회/수정)
[ ] 1-A-4. point_transactions 테이블 생성 + RLS 정책 (본인만 조회)
[ ] 1-A-5. escrow_holds 테이블 생성 + RLS 정책
[ ] 1-A-6. missions 테이블 생성 + RLS 정책 (UPDATE/DELETE 차단)
[ ] 1-A-7. mission_verifications 테이블 생성 + RLS 정책 (크루장만 INSERT)
[ ] 1-A-8. handle_new_user_wallet() 트리거 함수 + auth.users에 연결
[ ] 1-A-9. 기존 사용자 대상 user_points 레코드 수동 backfill
```

#### 1-B. 크루 생성 API 수정

```
[ ] 1-B-1. POST /api/crews 요청 body에 entry_points, leader_margin_rate, mission_reward_rate, missions[] 추가
[ ] 1-B-2. 서버사이드 유효성 검증 (배분율 합산 <= 90%, missions 최소 1개)
[ ] 1-B-3. crews INSERT + missions INSERT 트랜잭션 처리 (Supabase RPC 또는 순차 INSERT + 롤백 처리)
[ ] 1-B-4. 크루 생성 API 테스트 (missions 포함)
```

#### 1-C. 크루 생성 페이지 UI 수정

```
[ ] 1-C-1. 참여 포인트 입력 필드 추가
[ ] 1-C-2. 수익 배분율 입력 UI + 실시간 합산 검증 표시
[ ] 1-C-3. 미션 입력 UI → API payload에 포함되도록 수정 (현재 API 미연동 상태)
[ ] 1-C-4. 미션별 리워드 포인트 입력 필드 추가
[ ] 1-C-5. "생성 후 미션 변경 불가" 안내 문구 추가
[ ] 1-C-6. 최종 확인 모달 구현
[ ] 1-C-7. 크루 생성 UI 전체 통합 테스트
```

#### 1-D. 마이 월렛 페이지 구현

```
[ ] 1-D-1. GET /api/wallet API 구현 (user_points 조회)
[ ] 1-D-2. GET /api/wallet/transactions API 구현 (페이지네이션 포함)
[ ] 1-D-3. /wallet 페이지 UI 구현 (잔액 요약 + 거래 내역)
[ ] 1-D-4. 에스크로 현황 섹션 UI (참여 크루별 예치 금액)
[ ] 1-D-5. 충전 버튼: Step 1에서는 "충전 기능 준비 중" 비활성 처리
[ ] 1-D-6. Header에 포인트 잔액 간략 표시 (선택)
```

#### 1-E. 수동 충전으로 구조 검증

```
[ ] 1-E-1. Supabase SQL Editor에서 특정 사용자에게 포인트 수동 부여
[ ] 1-E-2. /wallet 페이지에서 잔액 정상 표시 확인
[ ] 1-E-3. point_transactions 거래 내역 표시 확인
[ ] 1-E-4. Step 1 완료 판단 기준: 지갑 UI 정상 동작 확인
```

---

### Step 2 — 에스크로 로직 (포인트 내부 이동)

**목표:** 실제 결제 없이 참여 신청 → 승인 → 에스크로 → 미션 인증 → 배분 전 플로우를 검증한다.

#### 2-A. Supabase 함수 구현

```
[ ] 2-A-1. process_entry_payment(p_crew_member_id UUID) 함수 작성
      - 크루원 포인트 잔액 확인 → 부족 시 EXCEPTION
      - user_points.balance 차감, escrow_balance 증가 (원자적)
      - escrow_holds INSERT
      - point_transactions INSERT (type: 'entry_payment')
      - crew_members UPDATE (payment_status: 'paid', paid_at: now())
[ ] 2-A-2. distribute_mission_reward(p_verification_id UUID) 함수 작성
      - mission_verifications에서 crew_id, mission_id 조회
      - active 크루원 목록 + 각 escrow_holds 조회
      - 배분 계산 (수수료 10% 선공제)
      - 크루원 각각 total_earned 증가, escrow_balance 차감
      - 크루장 balance 증가 (리더 마진)
      - point_transactions 다건 INSERT
      - escrow_holds.released_amount 업데이트
      - mission_verifications.distribution_status = 'completed'
[ ] 2-A-3. process_full_refund(p_crew_id UUID) 함수 작성
      - 해당 크루 escrow_holds 전체 조회
      - 미배분 잔액 계산 (amount - released_amount)
      - 각 크루원 balance += 미배분 잔액
      - escrow_balance -= 미배분 잔액
      - escrow_holds.status = 'refunded'
      - point_transactions INSERT (type: 'refund')
[ ] 2-A-4. 각 함수 단위 테스트 (Supabase SQL Editor에서 직접 호출)
```

#### 2-B. 참여 신청 승인 API 수정

```
[ ] 2-B-1. POST /api/crews/[id]/approve/[memberId] API 구현
      - 크루장 권한 확인
      - 정원 초과 확인
      - process_entry_payment() RPC 호출
      - 포인트 부족 에러 시 적절한 에러 응답 (400 + 메시지)
[ ] 2-B-2. 크루 대시보드 신청 관리 UI 수정
      - 신청자 포인트 잔액 표시 (포인트 부족 여부 사전 안내)
      - 승인 버튼 → API 호출
      - 포인트 부족 시 에러 모달
```

#### 2-C. 미션 인증 API 구현

```
[ ] 2-C-1. POST /api/crews/[id]/missions/[missionId]/verify API 구현
      - 크루장 권한 확인
      - 이미 인증된 미션 중복 차단
      - mission_verifications INSERT
      - distribute_mission_reward() RPC 호출
      - 실패 시 distribution_status: 'failed' 업데이트
[ ] 2-C-2. 크루 대시보드 미션 인증 UI 구현
      - 미션 목록 표시 (인증 여부 상태 포함)
      - "인증 처리" 버튼 + 확인 모달
      - 인증 완료 후 에스크로 현황 갱신
```

#### 2-D. 탈퇴 및 해산 API 구현

```
[ ] 2-D-1. POST /api/crews/[id]/leave API 구현 (자발적 탈퇴, 환급 없음)
      - "환급 없음" 확인 절차 (클라이언트 모달 + 서버 confirm 파라미터)
      - escrow_holds.status = 'forfeited'
      - crew_members.status = 'left'
      - point_transactions INSERT (type: 'forfeiture')
[ ] 2-D-2. POST /api/crews/[id]/disband API 구현 (크루장 귀책 해산)
      - process_full_refund() RPC 호출
      - crews.status = 'disbanded'
      - crew_members 전원 상태 변경
[ ] 2-D-3. 크루 대시보드 해산 UI (위험 영역, 강조된 경고 UI)
[ ] 2-D-4. 크루 상세 페이지 탈퇴 버튼 + 확인 모달
```

#### 2-E. 조기 시작 기능 구현

```
[ ] 2-E-1. crews 테이블에 status 컬럼 추가 (recruiting / active / completed / disbanded)
[ ] 2-E-2. crew_early_start_votes 테이블 생성 (crew_id, user_id, vote, voted_at)
[ ] 2-E-3. POST /api/crews/[id]/early-start API 구현 (크루장 전용)
      - 크루 status가 'recruiting'인지 확인
      - active 크루원 2명 이상인지 확인
      - 투표 시작 상태 기록
[ ] 2-E-4. POST /api/crews/[id]/early-start/vote API 구현 (크루원 전용)
      - 동의(agree) / 거절(reject) 투표
      - 전원 투표 완료 시 자동 집계:
        - 전원 동의 → crews.status = 'active', 추가 모집 종료
        - 거절자 있음 → 거절자 전액 환급 + 탈퇴, 나머지로 진행 여부 재투표 또는 취소
[ ] 2-E-5. 크루 대시보드에 "현 인원으로 시작하기" 버튼 추가 (정원 미달 시만 표시)
[ ] 2-E-6. 크루원에게 투표 요청 UI (크루 상세 또는 채팅 알림)
[ ] 2-E-7. 투표 결과에 따른 상태 전환 테스트
```

#### 2-F. Step 2 통합 테스트

```
[ ] 2-F-1. 테스트 시나리오 A: 참여 신청 → 승인 → 에스크로 예치 확인
[ ] 2-F-2. 테스트 시나리오 B: 미션 인증 → 배분 계산 정확성 확인 (소수점 나머지 크루장 귀속)
[ ] 2-F-3. 테스트 시나리오 C: 크루원 자발적 탈퇴 → 에스크로 몰수 → 잔여 크루원 균등 분배 확인
[ ] 2-F-4. 테스트 시나리오 D: 크루장 귀책 해산 → 전액 환급 확인
[ ] 2-F-5. 테스트 시나리오 E: 정원 미달 조기 시작 → 전원 동의 → 크루 active 전환 확인
[ ] 2-F-6. 테스트 시나리오 F: 조기 시작 → 거절자 환급 + 탈퇴 확인
[ ] 2-F-7. 포인트 잔액 정합성 검증 (balance + escrow_balance = 항상 일치)
[ ] 2-F-8. Step 2 완료 판단 기준: 전 시나리오 정상 동작 + 잔액 정합성 통과
```

---

### Step 3 — 토스페이먼츠 결제 연동

**목표:** 실제 현금 → 포인트 충전을 자동화한다.

#### 3-A. 토스페이먼츠 연동 준비

```
[ ] 3-A-1. 토스페이먼츠 개발자센터 가입 + 테스트 API 키 발급
[ ] 3-A-2. 환경변수 추가: TOSS_CLIENT_KEY, TOSS_SECRET_KEY
[ ] 3-A-3. @tosspayments/payment-widget 패키지 설치
[ ] 3-A-4. 결제 관련 타입 정의 (src/types/payment.ts)
```

#### 3-B. 충전 플로우 구현

```
[ ] 3-B-1. /wallet/charge 페이지 구현
      - 충전 금액 선택 UI (1,000 / 5,000 / 10,000 / 50,000 / 직접 입력)
      - 토스페이먼츠 Payment Widget 초기화
      - 결제 버튼
[ ] 3-B-2. POST /api/wallet/charge API 구현 (결제 시작 — orderId 생성)
[ ] 3-B-3. /wallet/success 페이지 구현 (토스 리다이렉트 대상)
[ ] 3-B-4. /wallet/fail 페이지 구현 (결제 실패/취소)
[ ] 3-B-5. POST /api/payments/confirm API 구현
      - 토스 서버에 결제 검증 요청 (서버-투-서버)
      - 검증 성공 시 user_points.balance += amount
      - point_transactions INSERT (type: 'charge')
      - idempotency: payment_key 중복 처리 방지
      - 검증 실패 시 토스 결제 취소 API 호출
[ ] 3-B-6. 결제 완료 후 /wallet 리다이렉트 + 잔액 갱신 확인
```

#### 3-C. 리워드 교환 기능 구현

```
[ ] 3-C-1. reward_redemptions 테이블 생성 (Step 1에서 미뤄진 경우)
[ ] 3-C-2. GET /api/rewards/items API 구현 (교환 가능 기프티콘 목록)
      - 초기에는 하드코딩 또는 별도 관리 테이블
[ ] 3-C-3. POST /api/rewards/redeem API 구현
      - 리워드 잔액(total_earned 기준) 확인
      - reward_redemptions INSERT
      - user_points.total_earned -= points_used (또는 별도 reward_balance 컬럼)
[ ] 3-C-4. /wallet/rewards 페이지 구현 (기프티콘 목록 + 교환 신청)
[ ] 3-C-5. 교환 신청 후 처리: 초기에는 수동 발송 (Phase 6에서 자동화)
```

#### 3-D. Step 3 검증

```
[ ] 3-D-1. 테스트 결제 (토스 테스트 환경) → 포인트 충전 정상 확인
[ ] 3-D-2. 결제 실패 시나리오 → 롤백 정상 확인
[ ] 3-D-3. 동일 payment_key 중복 요청 → 거부 확인
[ ] 3-D-4. 프로덕션 전환 전 토스페이먼츠 검수 신청
[ ] 3-D-5. npm run build 에러 0 확인
```

---

## 8. 리스크 및 고려사항

### 8-1. 데이터 정합성 리스크

| 리스크 | 대응 방안 |
|--------|-----------|
| 포인트 차감 후 에스크로 INSERT 실패 | 모든 포인트 이동을 PostgreSQL 트랜잭션(함수)으로 처리 |
| 중복 결제 처리 | payment_key UNIQUE 제약 + idempotency 검증 |
| 배분 계산 소수점 오차 | INTEGER 포인트 기준 FLOOR/ROUND 정책 명시 (소수점 발생 시 크루장에게 귀속 권장) |

### 8-2. 정책 결정 완료 (2026-03-11)

| 번호 | 이슈 | 확정 |
|------|------|------|
| 1 | 참여 신청 시 포인트 잔액 확인 | **A: 잔액 부족해도 신청 가능** (승인 시점에 잔액 부족이면 차단) |
| 2 | 배분 시 소수점 처리 | **A: 나머지는 크루장에게 귀속** |
| 3 | 자발적 탈퇴 후 에스크로 몰수 포인트 | **B: 잔여 크루원에게 균등 분배** |
| 4 | 크루 정원 미달 시 처리 | **별도 정책: 조기 시작 기능** (아래 상세) |

#### 정원 미달 조기 시작 정책 (항목 4 상세)

정원이 안 찬 상태에서 크루장이 현재 인원으로 크루를 시작할 수 있다.

**플로우:**
1. 크루장이 "현 인원으로 시작하기" 요청
2. 모든 active 크루원에게 동의 요청 발송
3. 전원 동의 시 → 크루 상태 `recruiting` → `active` 전환, 추가 모집 종료
4. 1명이라도 거절 시 → 시작 불가, 거절한 크루원에게 전액 환급 후 탈퇴 처리

**DB 변경:**
- `crews` 테이블에 `status` 컬럼 추가: `recruiting` / `active` / `completed` / `disbanded`
- `crew_early_start_votes` 테이블 신규 생성 (crew_id, user_id, vote: `agree`/`reject`, voted_at)

**API:**
- `POST /api/crews/[id]/early-start` — 크루장이 조기 시작 요청
- `POST /api/crews/[id]/early-start/vote` — 크루원이 동의/거절 투표
- 전원 투표 완료 시 자동 집계 → 결과에 따라 상태 전환

### 8-3. Phase 6에서 처리할 사항 (현재 범위 외)

- 기프티콘 발송 자동화 (SendB/비즈콘 API)
- 토스페이먼츠 환불 API 연동 (현재는 수동 환불)
- 포인트 만료 정책
- 세금계산서 / 정산서 발행

---

## 9. 마일스톤

| 마일스톤 | 내용 | 완료 기준 |
|----------|------|-----------|
| M4-1 | Step 1 완료 | 수동 충전 포인트가 /wallet에 표시됨 |
| M4-2 | Step 2 완료 | 에스크로 전 플로우 (신청/승인/미션/탈퇴/해산) 정상 동작 |
| M4-3 | Step 3 완료 | 토스 테스트 결제 → 포인트 충전 정상 동작 |
| M4-4 | Phase 4 완료 | 프로덕션 결제 검수 통과 + 전체 E2E 테스트 통과 |

---

*다음 단계: 위 "8-2. 미결정 사항" 4건에 대한 정책 결정 후 Step 1-A DB 스키마 작업 시작*
