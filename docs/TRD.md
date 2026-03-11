---
title: 여행 플래너 TRD
version: v1.0
status: active
created: 2026-03-11
updated: 2026-03-11
owner: daehoonkim
---

## Changelog

| 버전 | 날짜  | 작성자      | 변경 내용          |
| ---- | ----- | ----------- | ------------------ |
| v1.0 | 03-11 | daehoonkim  | 초안 작성 (현재 코드베이스 기반) |

---

# TRD: 여행 플래너 (Travel Planner)

> **관련 문서**: [PRD](./PRD.md) | [TASKS](./TASKS.md)

## 1. 시스템 아키텍처

### 1.1 전체 구조

```
┌─────────────────────────────────────────────────────────┐
│                    클라이언트 (PWA)                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │ Next.js  │  │  React   │  │ Zustand  │  │ Serwist  │ │
│  │ App      │  │  19 +    │  │ (Auth    │  │ (Service │ │
│  │ Router   │  │ shadcn/ui│  │  Store)  │  │  Worker) │ │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘ │
└───────┼──────────────┼─────────────┼─────────────┼───────┘
        │              │             │             │
        ▼              ▼             ▼             ▼
┌───────────────────────────────────────────────────────────┐
│                  Next.js API Routes (서버)                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │ /api/ai  │  │/api/place│  │/api/scrap│  │/api/auth │  │
│  │/recommend │  │  /share  │  │    e     │  │/callback │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  │
└───────┼──────────────┼─────────────┼─────────────┼────────┘
        │              │             │             │
        ▼              ▼             ▼             ▼
┌──────────┐  ┌───────────────┐  ┌──────────┐  ┌──────────┐
│ Gemini   │  │   Supabase    │  │ Google   │  │ External │
│ 2.0 Flash│  │ ┌───────────┐ │  │ Places   │  │ Websites │
│ (AI)     │  │ │ PostgreSQL│ │  │ API      │  │ (스크래핑)│
│          │  │ │   + RLS   │ │  │          │  │          │
│          │  │ ├───────────┤ │  │          │  │          │
│          │  │ │ Realtime  │ │  │          │  │          │
│          │  │ ├───────────┤ │  │          │  │          │
│          │  │ │   Auth    │ │  │          │  │          │
│          │  │ ├───────────┤ │  │          │  │          │
│          │  │ │  Storage  │ │  │          │  │          │
│          │  │ └───────────┘ │  │          │  │          │
└──────────┘  └───────────────┘  └──────────┘  └──────────┘
```

### 1.2 기술 스택

| 레이어 | 기술 | 버전 | 용도 |
|--------|------|------|------|
| **프레임워크** | Next.js | 16.1.6 | SSR, App Router, API Routes |
| **UI 라이브러리** | React | 19.2.3 | 컴포넌트 기반 UI |
| **언어** | TypeScript | 5.x | 타입 안전성 |
| **스타일링** | Tailwind CSS | 4.x | 유틸리티 기반 CSS |
| **UI 컴포넌트** | shadcn/ui + Base UI | - | 재사용 가능한 UI 컴포넌트 |
| **상태 관리** | Zustand | 5.0.11 | 클라이언트 전역 상태 (Auth) |
| **BaaS** | Supabase | 2.99.0 | DB, Auth, Realtime, Storage |
| **AI** | Google Gemini | 0.24.1 | 추천, 일정 생성 |
| **지도** | Google Maps JS API | 3.58.1 | 지도 렌더링, 장소 검색 |
| **DnD** | dnd-kit | 6.3/10.0 | 일정 드래그앤드롭 |
| **PWA** | Serwist | 9.5.6 | Service Worker, 오프라인 |
| **차트** | Recharts | 3.8.0 | 지출 시각화 |
| **날짜** | date-fns | 4.1.0 | 날짜 연산/포맷 |

---

## 2. 디렉토리 구조

```
src/
├── app/                      # Next.js App Router
│   ├── (auth)/               # 인증 그룹 (별도 레이아웃)
│   │   ├── login/
│   │   └── signup/
│   ├── (main)/               # 메인 앱 그룹 (AppShell 래핑)
│   │   ├── dashboard/        # 여행 목록
│   │   ├── explore/          # 탐색
│   │   ├── notifications/    # 알림
│   │   ├── profile/          # 프로필
│   │   └── trips/[tripId]/   # 여행 상세 (동적 라우팅)
│   │       ├── places/       # 장소 목록 + 지도
│   │       ├── schedule/     # 일정
│   │       ├── budget/       # 예산
│   │       ├── journal/      # 후기
│   │       └── members/      # 멤버
│   ├── api/                  # API Routes (서버사이드)
│   ├── join/[inviteCode]/    # 초대 참가
│   ├── share-target/         # PWA Share Target
│   └── offline/              # 오프라인 폴백
│
├── components/               # React 컴포넌트
│   ├── ai/                   # AI 채팅 (FAB + 바텀시트)
│   ├── layout/               # 레이아웃 (AppShell, Sidebar, BottomNav)
│   ├── maps/                 # Google Maps 관련
│   ├── places/               # 장소 폼, 투표
│   ├── schedule/             # 일정 (캘린더, 타임라인, DnD)
│   ├── realtime/             # 실시간 (Presence, Activity)
│   ├── trip/                 # 여행 헤더, 탭, 수정
│   ├── budget/               # 예산 관련
│   ├── journal/              # 후기 관련
│   └── ui/                   # shadcn/ui 기본 컴포넌트
│
├── lib/                      # 유틸리티 & 외부 서비스
│   ├── supabase/             # Supabase 클라이언트 (browser/server/middleware)
│   ├── google-places/        # Google Places API 래퍼
│   ├── maps/                 # Google Maps Loader
│   ├── scraper/              # URL 스크래핑 (SSRF 방어)
│   └── utils.ts              # 공통 유틸 (cn 등)
│
├── stores/                   # Zustand 스토어
│   └── auth-store.ts         # 인증 상태 관리
│
├── config/                   # 앱 설정
│   └── navigation.ts         # 네비게이션 항목 정의
│
├── hooks/                    # 커스텀 React 훅
│   └── use-supabase.ts
│
└── types/                    # TypeScript 타입 정의
    └── database.ts           # DB 스키마 매핑 타입
```

---

## 3. 데이터 모델

### 3.1 ERD (Entity Relationship Diagram)

```
┌──────────────┐       ┌──────────────────┐       ┌──────────────┐
│   profiles   │       │   trip_members    │       │    trips     │
├──────────────┤       ├──────────────────┤       ├──────────────┤
│ id (PK)      │──┐    │ id (PK)          │    ┌──│ id (PK)      │
│ display_name │  │    │ trip_id (FK)     │────┘  │ title        │
│ avatar_url   │  └────│ user_id (FK)     │       │ destination  │
│ created_at   │       │ role             │       │ start_date   │
└──────────────┘       │ joined_at        │       │ end_date     │
       │               └──────────────────┘       │ cover_image  │
       │                                          │ invite_code  │
       │                                          │ created_by   │
       │               ┌──────────────────┐       │ created_at   │
       │               │     places       │       │ updated_at   │
       │               ├──────────────────┤       └──────┬───────┘
       │               │ id (PK)          │              │
       │               │ trip_id (FK)     │──────────────┘
       └───────────────│ added_by (FK)    │
                       │ category         │
                       │ name             │
                       │ url              │──────────────┐
                       │ image_urls[]     │              │
                       │ latitude         │       ┌──────┴───────┐
                       │ longitude        │       │ place_votes  │
                       │ address          │       ├──────────────┤
                       │ rating           │       │ id (PK)      │
                       │ memo             │       │ place_id(FK) │
                       │ price_per_night  │       │ user_id (FK) │
                       │ amenities[]      │       │ vote_type    │
                       │ source_url       │       │ comment      │
                       │ google_place_id  │       │ created_at   │
                       │ enriched         │       └──────────────┘
                       │ enriched_at      │
                       │ enrich_error     │
                       │ enrich_attempts  │
                       └────────┬─────────┘
                                │
                 ┌──────────────┤
                 │              │
        ┌────────┴───────┐     │
        │   schedules    │     │
        ├────────────────┤     │
        │ id (PK)        │     │
        │ trip_id (FK)   │     │
        │ date           │     │
        │ day_memo       │     │
        └────────┬───────┘     │
                 │             │
        ┌────────┴───────┐     │
        │ schedule_items │     │
        ├────────────────┤     │
        │ id (PK)        │     │
        │ schedule_id(FK)│     │
        │ place_id (FK)  │─────┘
        │ title          │
        │ start_time     │
        │ end_time       │
        │ sort_order     │
        │ memo           │
        │ transport_next │
        └────────────────┘

        ┌────────────────┐     ┌────────────────┐
        │    budgets     │     │   expenses     │
        ├────────────────┤     ├────────────────┤
        │ id (PK)        │     │ id (PK)        │
        │ trip_id (FK)   │     │ trip_id (FK)   │
        │ total_budget   │     │ category       │
        │ currency       │     │ title          │
        └────────────────┘     │ amount         │
                               │ currency       │
        ┌────────────────┐     │ paid_by (FK)   │
        │  settlements   │     │ date           │
        ├────────────────┤     │ memo           │
        │ id (PK)        │     └────────────────┘
        │ trip_id (FK)   │
        │ from_user (FK) │     ┌────────────────┐
        │ to_user (FK)   │     │ trip_journals  │
        │ amount         │     ├────────────────┤
        │ is_settled     │     │ id (PK)        │
        └────────────────┘     │ trip_id (FK)   │
                               │ author_id (FK) │
        ┌────────────────┐     │ date           │
        │ activity_logs  │     │ content        │
        ├────────────────┤     │ photo_urls[]   │
        │ id (PK)        │     └────────────────┘
        │ trip_id (FK)   │
        │ user_id (FK)   │
        │ action         │
        │ target_type    │
        │ target_id      │
        │ metadata       │
        └────────────────┘
```

### 3.2 주요 관계

| 관계 | 설명 |
|------|------|
| profiles → trip_members | 1:N (한 사용자가 여러 여행 참가) |
| trips → trip_members | 1:N (한 여행에 여러 멤버) |
| trips → places | 1:N (한 여행에 여러 장소) |
| places → place_votes | 1:N (한 장소에 여러 투표) |
| trips → schedules | 1:N (한 여행에 날짜별 일정) |
| schedules → schedule_items | 1:N (한 일정에 여러 항목) |
| schedule_items → places | N:1 (일정 항목이 장소 참조, nullable) |
| trips → budgets | 1:N (한 여행에 통화별 예산) |
| trips → expenses | 1:N (한 여행에 여러 지출) |
| trips → settlements | 1:N (한 여행에 여러 정산) |
| trips → trip_journals | 1:N (한 여행에 여러 후기) |
| trips → activity_logs | 1:N (한 여행에 여러 활동 로그) |

### 3.3 타입 정의

```typescript
// 역할 (권한 레벨)
type MemberRole = "admin" | "editor" | "viewer";

// 장소 카테고리
type PlaceCategory = "accommodation" | "attraction" | "restaurant" | "other";

// 지출 카테고리
type ExpenseCategory = "accommodation" | "food" | "transport" | "activity" | "shopping" | "other";

// 지원 통화
type CurrencyCode = "KRW" | "JPY" | "USD" | "EUR" | "CNY" | "THB" | "VND";
```

---

## 4. API 설계

### 4.1 API Routes

| 경로 | 메서드 | 인증 | 설명 |
|------|--------|------|------|
| `/api/auth/callback` | GET | - | OAuth 콜백 처리 |
| `/api/ai/recommend` | POST | 필수 | AI 추천/일정 생성 |
| `/api/places/share` | POST | 필수 | Share Target 장소 저장 |
| `/api/places/[id]/enrich` | POST | 필수 | 장소 정보 풍부화 트리거 |
| `/api/scrape` | POST | 필수 | URL 메타데이터 스크래핑 |
| `/api/share/receive` | POST | 필수 | 공유 링크 수신 처리 |

### 4.2 API 상세: `/api/ai/recommend`

```typescript
// Request
POST /api/ai/recommend
{
  mode: "recommend" | "generate-schedule" | "route-check" | "fill-empty",
  tripContext: {
    title: string,
    destination: string,
    startDate: string,
    endDate: string,
    places: Place[],
    schedules: Schedule[]
  },
  messages: Array<{ role: "user" | "assistant", content: string }>,
  userMessage: string
}

// Response
{
  reply: string  // AI 마크다운 응답
}
```

### 4.3 API 상세: `/api/places/share`

```typescript
// Request
POST /api/places/share
{
  url: string,        // 공유된 URL
  title?: string,     // 공유 제목 (optional)
  tripId: string      // 대상 여행 ID
}

// Response (성공)
{
  success: true,
  place: Place,
  enriching: boolean  // 비동기 풍부화 진행 중 여부
}

// Response (중복)
{
  success: true,
  place: Place,
  duplicate: true
}
```

### 4.4 Supabase RPC

| 함수명 | 용도 |
|--------|------|
| `create_trip_with_member` | 여행 생성 + 생성자를 admin으로 자동 추가 |

### 4.5 Supabase Realtime 채널

| 채널 | 이벤트 | 용도 |
|------|--------|------|
| `trip:{tripId}` | INSERT/UPDATE/DELETE | 여행 데이터 실시간 동기화 |
| `presence:trip:{tripId}` | sync/join/leave | 온라인 멤버 표시 |

---

## 5. 인증 & 권한

### 5.1 인증 흐름

```
[사용자] → [로그인 페이지] → [Supabase Auth (OAuth)]
                                      ↓
                            [콜백: /api/auth/callback]
                                      ↓
                            [세션 쿠키 설정]
                                      ↓
                            [Middleware: 경로 보호]
                                      ↓
                            [AppShell: 프로필 로드 → Zustand]
```

### 5.2 미들웨어 경로 보호

```typescript
// 보호된 경로 (로그인 필수)
matcher: ['/dashboard', '/trips/:path*', '/profile', '/notifications', '/explore']

// 공개 경로
matcher: ['/login', '/signup', '/join/:inviteCode', '/offline']
```

### 5.3 권한 모델

| 역할 | 읽기 | 장소 추가 | 일정 수정 | 멤버 관리 | 여행 삭제 |
|------|------|----------|----------|----------|----------|
| admin | ✅ | ✅ | ✅ | ✅ | ✅ |
| editor | ✅ | ✅ | ✅ | ❌ | ❌ |
| viewer | ✅ | ❌ | ❌ | ❌ | ❌ |

---

## 6. 외부 서비스 연동

### 6.1 Google Maps JavaScript API

| 용도 | 컴포넌트 |
|------|---------|
| 지도 렌더링 + 마커 | `components/maps/place-map.tsx` |
| 경로 표시 | `components/maps/route-map.tsx` |
| 장소 자동완성 검색 | `components/maps/place-search.tsx` |

**로드 방식**: `@googlemaps/js-api-loader`로 동적 로드

### 6.2 Google Places API (New)

| 기능 | 엔드포인트 | 래퍼 |
|------|-----------|------|
| Text Search | `places.googleapis.com/v1/places:searchText` | `lib/google-places/client.ts` |
| Place Details | `places.googleapis.com/v1/places/{id}` | `lib/google-places/client.ts` |
| Photo URL | `places.googleapis.com/v1/{name}/media` | `lib/google-places/client.ts` |

### 6.3 Google Gemini AI

| 항목 | 값 |
|------|------|
| 모델 | `gemini-2.0-flash` |
| 용도 | 여행 추천, 일정 생성, 동선 검토 |
| 호출 위치 | `/api/ai/recommend` (서버사이드) |
| 컨텍스트 | 여행 정보 + 등록된 장소 + 현재 일정 |

### 6.4 URL 스크래핑 지원 사이트

| 도메인 | 카테고리 |
|--------|---------|
| booking.com | 숙소 |
| agoda.com | 숙소 |
| hotels.com | 숙소 |
| airbnb.com / airbnb.co.kr | 숙소 |
| yanolja.com | 숙소 |
| goodchoice.kr | 숙소 |
| trip.com | 숙소 |
| expedia.com | 숙소 |
| google.com/maps | 장소 전반 |
| google.com/travel | 장소 전반 |
| naver.com | 장소 전반 |
| kakao.com | 장소 전반 |

---

## 7. PWA & 오프라인

### 7.1 Service Worker 전략

| 리소스 | 캐싱 전략 | 설명 |
|--------|----------|------|
| API 응답 / Supabase | NetworkFirst | 네트워크 우선, 실패 시 캐시 |
| 이미지 | CacheFirst | 캐시 우선 (변경 드묾) |
| 정적 자산 (JS/CSS) | StaleWhileRevalidate | 캐시 먼저 보여주고 백그라운드 갱신 |
| 오프라인 폴백 | Precache | `/offline` 페이지 사전 캐싱 |

### 7.2 PWA Manifest

```json
{
  "name": "여행 플래너",
  "short_name": "여행플래너",
  "start_url": "/dashboard",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#3b82f6",
  "icons": [
    { "src": "/icons/icon-192x192.png", "sizes": "192x192" },
    { "src": "/icons/icon-512x512.png", "sizes": "512x512" }
  ],
  "share_target": {
    "action": "/share-target",
    "method": "GET",
    "params": { "url": "url", "title": "title", "text": "text" }
  }
}
```

### 7.3 Share Target 플로우

```
[OS 공유 인텐트] → [/share-target?url=...&title=...]
        ↓
[share-target/page.tsx]
  ├ 로그인 확인
  ├ 최근 여행 목록 표시 (또는 Sticky Context 자동 선택)
  └ 선택 후 → POST /api/places/share
        ↓
[즉시 응답] → enriched=false로 저장
        ↓
[비동기] → URL 파싱 → Google Places API → 메타데이터 채움
```

---

## 8. 보안

### 8.1 SSRF 방어 (`lib/scraper/index.ts`)

```
[URL 입력] → 프로토콜 검증 (https만)
     ↓
[도메인 화이트리스트 체크]
     ↓
[DNS 해석] → 사설 IP 차단 (10.x, 172.16-31.x, 192.168.x, 127.x)
     ↓
[요청 전송] → 응답 크기 제한 (5MB)
     ↓
[HTML 파싱] → 메타데이터 추출
```

### 8.2 Rate Limiting

| API | 제한 | 방식 |
|-----|------|------|
| `/api/places/share` | 사용자당 10req/min | In-memory Map |

### 8.3 입력 검증

| 항목 | 검증 |
|------|------|
| URL | 프로토콜(https), 도메인, 길이(< 2048) |
| tripId | UUID 형식 |
| 사용자 권한 | trip_members에서 역할 확인 |

---

## 9. 성능 고려사항

### 9.1 데이터 페칭

| 방식 | 사용처 |
|------|--------|
| Supabase 직접 쿼리 | 대부분의 CRUD (클라이언트 사이드) |
| Next.js API Routes | AI, 스크래핑, 풍부화 (서버 사이드) |
| Supabase Realtime | 실시간 데이터 동기화 |

### 9.2 최적화 포인트

| 영역 | 현재 | 개선 방향 |
|------|------|----------|
| Google Maps 로드 | 동적 로딩 | ✅ 이미 최적화 |
| 이미지 | 원본 URL 직접 사용 | Next/Image + CDN 검토 |
| 번들 사이즈 | 미측정 | Tree-shaking, 코드 스플리팅 |
| DB 쿼리 | 기본 쿼리 | 인덱스 최적화 (대규모 여행 대비) |
| AI 응답 | 동기 응답 | 스트리밍 응답 검토 |

### 9.3 인덱스 (DB)

| 인덱스 | 대상 |
|--------|------|
| `idx_places_pending_enrichment` | places (enriched=false) |
| `idx_places_google_place_id` | places (google_place_id) |
| `idx_places_source_url` | places (source_url) |

---

## 10. 배포 & 인프라

### 10.1 배포 환경

| 항목 | 서비스 | 비고 |
|------|--------|------|
| 호스팅 | Vercel (예상) | Next.js 최적 |
| 데이터베이스 | Supabase (PostgreSQL) | 무료 티어 |
| 파일 스토리지 | Supabase Storage | 이미지 업로드 |
| CDN | Vercel Edge | 정적 자산 |
| 도메인 | 미정 | - |

### 10.2 환경변수

| 변수 | 용도 |
|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 공개 키 |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase 서비스 키 (서버만) |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Google Maps API 키 |
| `GOOGLE_PLACES_API_KEY` | Google Places API 키 (서버만) |
| `GOOGLE_GEMINI_API_KEY` | Gemini AI API 키 (서버만) |

---

## 11. 테스트 전략 (계획)

### 11.1 현재 상태

테스트 코드 없음. MVP 단계로 수동 테스트 진행 중.

### 11.2 목표 테스트 커버리지

| 레벨 | 도구 | 대상 | 우선순위 |
|------|------|------|---------|
| Unit | Vitest | lib/, utils, 타입 검증 | P1 |
| Component | Testing Library | 주요 컴포넌트 | P2 |
| Integration | Vitest + MSW | API Routes | P1 |
| E2E | Playwright | 핵심 사용자 플로우 | P2 |

### 11.3 우선 테스트 대상

1. `lib/google-places/` - URL 파싱, Places API 호출
2. `lib/scraper/` - SSRF 방어, 메타데이터 추출
3. `/api/places/share` - Rate limiting, 중복 감지
4. `/api/ai/recommend` - 컨텍스트 구성, 에러 처리

---

## 12. 기술 부채 & 개선 과제

| 항목 | 현재 | 개선 방향 | 우선순위 |
|------|------|----------|---------|
| 에러 핸들링 | API별 개별 처리 | 통일된 에러 바운더리 + 사용자 메시지 | P1 |
| 타입 안전성 | database.ts 수동 관리 | Supabase CLI 자동 타입 생성 | P1 |
| Rate Limiting | In-memory (서버리스에서 리셋됨) | Redis 또는 Supabase 기반 | P2 |
| 이미지 최적화 | 외부 URL 직접 렌더링 | Next/Image + Supabase Storage 프록시 | P2 |
| 번들 분석 | 미수행 | @next/bundle-analyzer 도입 | P2 |
| 모니터링 | 없음 | Sentry 에러 트래킹 | P1 |
| CI/CD | 없음 | GitHub Actions (빌드/테스트/배포) | P1 |
| 환경 분리 | .env.local 단일 | 개발/스테이징/프로덕션 분리 | P2 |
