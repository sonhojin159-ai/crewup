# Project IDEA - 부업 크루 매칭 플랫폼

## 프로젝트 개요
부업(사이드잡)에 관심 있는 사람들이 크루(팀)를 만들고 참여할 수 있는 웹 플랫폼.
함께 부업을 시작하고 운영할 동료를 찾아주는 서비스.

## 기술 스택
- **Frontend**: Next.js (App Router) + TypeScript
- **Styling**: Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: Supabase (PostgreSQL + Auth)
- **Deployment**: Vercel

## 주요 기능
- 부업 크루 생성 및 관리
- 크루 검색 및 참여 신청
- 부업 카테고리별 탐색 (배달, 온라인 판매, 프리랜서, 투자 등)
- 사용자 프로필 및 인증
- 크루 내 소통 기능

## 코딩 컨벤션
- 언어: TypeScript (strict mode)
- 컴포넌트: 함수형 컴포넌트 + React Server Components 우선
- 네이밍: camelCase (변수/함수), PascalCase (컴포넌트/타입)
- 파일 구조: feature 기반 폴더 구조
- 커밋 메시지: 한국어 허용, conventional commits 형식

## 디렉토리 구조
```
src/
├── app/           # Next.js App Router 페이지
├── components/    # 공통 UI 컴포넌트
├── features/      # 기능별 모듈 (crew, auth, profile 등)
├── lib/           # 유틸리티, DB 클라이언트
└── types/         # 공통 타입 정의
```

## 작업 지침
- 한국어 UI 기본
- 모바일 퍼스트 반응형 디자인
- 접근성(a11y) 고려
- SEO 최적화
