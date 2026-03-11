# Travel Planner — Project Instructions

## 프로젝트 개요

여행 계획을 함께 세우고, 실시간 협업하며, AI가 보조하는 웹앱 (PWA).

- **스택**: Next.js 16 + React 19 + TypeScript + Supabase + Tailwind CSS 4
- **AI**: Google Gemini 2.0 Flash
- **지도**: Google Maps/Places API
- **실시간**: Supabase Realtime (Postgres Changes + Presence)
- **PWA**: Serwist (Service Worker, Share Target)
- **상태**: Zustand (auth) + React Query (server cache) + Realtime (sync)

## 핵심 문서

작업 전 반드시 관련 문서를 확인할 것.

| 문서 | 용도 |
| ---- | ---- |
| `docs/PRD.md` | 제품 요구사항, 기능 목록, 우선순위 |
| `docs/TRD.md` | 기술 아키텍처, DB 스키마, API 설계 |
| `docs/SPEC.md` | 입력/출력 명세, 규칙, 기본값 |
| `docs/TASKS.md` | 백로그, 진행 중, 완료, 기술부채 |
| `docs/GUIDE-DEVELOPMENT.md` | 개발 환경, 코딩 패턴, FAQ |
| `docs/DEVELOPMENT-CHECKLIST.md` | 기획→배포 115항목 체크리스트 |
| `docs/plans/MASTER_PLAN.md` | 로드맵, Tier별 우선순위 |

## 프로젝트 구조

```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/             # 로그인/회원가입 (별도 레이아웃)
│   ├── (main)/             # 메인 앱 (AppShell 래핑)
│   │   └── trips/[tripId]/ # 여행별: places/schedule/budget/journal/members
│   ├── api/                # 서버 API Routes
│   └── share-target/       # PWA Share Target
├── components/             # 도메인별 컴포넌트
│   ├── layout/             # AppShell, Sidebar, BottomNav
│   ├── realtime/           # RealtimeProvider, Presence
│   └── ui/                 # shadcn/ui 기본 컴포넌트
├── lib/
│   ├── supabase/           # client.ts(브라우저) / server.ts(서버) / middleware.ts
│   ├── google-places/      # Places API 래퍼
│   └── scraper/            # URL 스크래핑 (SSRF 방어)
├── stores/                 # Zustand (auth-store.ts)
├── config/                 # navigation.ts
├── hooks/                  # use-supabase.ts
├── types/                  # database.ts (DB 스키마 매핑)
└── middleware.ts           # 인증 경로 보호 (Edge)
```

## 코딩 규칙

### Supabase 클라이언트 구분 (혼용 금지)

- **Client Component** (`"use client"`): `import { createClient } from "@/lib/supabase/client"`
- **Server Component / API Route**: `import { createClient } from "@/lib/supabase/server"`
- **Middleware**: `import { updateSession } from "@/lib/supabase/middleware"`

### 상태 관리 선택 기준

| 데이터 유형 | 도구 | 예시 |
| ----------- | ---- | ---- |
| 인증 사용자 | Zustand (`auth-store`) | `useAuthStore()` |
| DB 데이터 (캐싱) | React Query | `useQuery({ queryKey: ["places", tripId] })` |
| 실시간 동기화 | Supabase Realtime → React Query invalidate | `RealtimeProvider` |
| 폼/UI 로컬 | `useState` | 입력값, 토글 |

### API Route 패턴

모든 API Route는 이 순서를 따른다:
1. 인증 확인 (`supabase.auth.getUser()`)
2. 입력 파싱 & 검증
3. 권한 확인 (`trip_members` 역할 체크)
4. 비즈니스 로직
5. 응답 반환

### 파일 명명

- 컴포넌트/파일: `kebab-case.tsx` (예: `place-form.tsx`)
- 타입: `types/database.ts`에 통합
- 경로 별칭: `@/*` → `./src/*`

### 반응형

- 모바일 기본 → `md:` (768px)에서 데스크톱 오버라이드
- 모바일: BottomNav (하단 64px, `pb-16`)
- 데스크톱: Sidebar (좌측 64px, `md:pl-64 md:pb-0`)

### 스타일링

- Tailwind CSS 유틸리티 클래스 사용
- 조건부 클래스: `cn()` (`@/lib/utils`)
- UI 컴포넌트: `components/ui/` (shadcn/ui)

## 환경변수

| 변수 | 위치 | 용도 |
| ---- | ---- | ---- |
| `NEXT_PUBLIC_SUPABASE_URL` | 클라이언트 | Supabase URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 클라이언트 | Supabase 공개 키 |
| `SUPABASE_SERVICE_ROLE_KEY` | 서버 전용 | Supabase 서비스 키 |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | 클라이언트 | Google Maps |
| `GOOGLE_PLACES_API_KEY` | 서버 전용 | Google Places |
| `GEMINI_API_KEY` | 서버 전용 | Gemini AI |

> `NEXT_PUBLIC_` 접두사 = 클라이언트 노출. 서버 전용 키에 절대 붙이지 말 것.

## 명령어

```bash
npm run dev     # 개발 서버
npm run build   # 프로덕션 빌드
npm run lint    # ESLint
```

## DB 테이블 (Supabase PostgreSQL)

profiles, trips, trip_members, places, place_votes, schedules, schedule_items, budgets, expenses, settlements, trip_journals, activity_logs

타입 정의: `src/types/database.ts`

## 작업 완료 시

1. `docs/TASKS.md`: 백로그 → 완료됨 이동 (완료일 기재)
2. `docs/PRD.md`: 기능 상태 ✅로 변경
3. `docs/plans/MASTER_PLAN.md`: 완료 이력 추가
4. 관련 계획 문서 → `docs/archive/`로 이동

## 새 기능 추가 시

1. `docs/plans/[feature]/plan-[feature]-[date].md` 작성 (템플릿: `docs/templates/plan.md`)
2. `docs/TASKS.md` 백로그에 추가
3. 구현 후 위 "작업 완료 시" 절차 수행
