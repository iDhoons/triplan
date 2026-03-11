---
title: 개발 가이드
version: v1.0
status: active
created: 2026-03-11
updated: 2026-03-11
owner: daehoonkim
---

## Changelog

| 버전 | 날짜  | 작성자     | 변경 내용          |
| ---- | ----- | ---------- | ------------------ |
| v1.0 | 03-11 | daehoonkim | 초안 작성          |

---

# 개발 가이드: Travel Planner

> **관련 문서**: [TRD](./TRD.md) | [SPEC](./SPEC.md) | [TASKS](./TASKS.md)

---

## 1. 환경 설정

### 1.1 필수 도구

| 도구 | 버전 | 용도 |
| ---- | ---- | ---- |
| Node.js | 20+ | 런타임 |
| npm | 10+ | 패키지 관리 |
| Git | 2.40+ | 버전 관리 |
| Supabase CLI | 최신 | DB 마이그레이션 |

### 1.2 프로젝트 설정

```bash
# 1. 클론
git clone <repo-url>
cd travel-planner

# 2. 의존성 설치
npm install

# 3. 환경변수 설정
cp .env.local.example .env.local
# .env.local에 실제 키 입력

# 4. 개발 서버
npm run dev    # http://localhost:3000
```

### 1.3 환경변수

| 변수 | 필수 | 설명 |
| ---- | ---- | ---- |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase 공개 키 |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase 서비스 키 (서버 전용) |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | ✅ | Google Maps API 키 (클라이언트) |
| `GOOGLE_PLACES_API_KEY` | ✅ | Google Places API 키 (서버 전용) |
| `GEMINI_API_KEY` | ✅ | Gemini AI API 키 (서버 전용) |

> `NEXT_PUBLIC_` 접두사가 있는 변수만 클라이언트에 노출됩니다. 서버 전용 키에 절대 붙이지 마세요.

### 1.4 스크립트

```bash
npm run dev     # 개발 서버 (Turbopack)
npm run build   # 프로덕션 빌드
npm start       # 프로덕션 서버
npm run lint    # ESLint 검사
```

---

## 2. 프로젝트 구조

```
src/
├── app/                        # Next.js App Router (라우팅)
│   ├── (auth)/                 # 인증 페이지 그룹 (별도 레이아웃)
│   ├── (main)/                 # 메인 앱 그룹 (AppShell 래핑)
│   │   └── trips/[tripId]/     # 여행별 동적 라우팅
│   ├── api/                    # API Routes (서버사이드)
│   ├── layout.tsx              # 루트 레이아웃
│   ├── providers.tsx           # 전역 Provider
│   ├── sw.ts                   # Service Worker
│   └── manifest.ts             # PWA Manifest
│
├── components/                 # React 컴포넌트
│   ├── ai/                     # AI 채팅 (FAB + 바텀시트)
│   ├── layout/                 # 레이아웃 (AppShell, Sidebar, BottomNav)
│   ├── maps/                   # Google Maps
│   ├── places/                 # 장소 관련
│   ├── schedule/               # 일정 관련 (DnD 포함)
│   ├── realtime/               # Realtime (Presence, Activity)
│   ├── trip/                   # 여행 헤더/탭/수정
│   └── ui/                     # shadcn/ui 기본 컴포넌트
│
├── lib/                        # 외부 서비스 래퍼
│   ├── supabase/               # client.ts / server.ts / middleware.ts
│   ├── google-places/          # client.ts / enricher.ts / url-parser.ts
│   ├── maps/                   # Google Maps Loader
│   └── scraper/                # URL 스크래핑 (SSRF 방어)
│
├── stores/                     # Zustand 전역 상태
├── config/                     # 네비게이션 등 설정
├── hooks/                      # 커스텀 React 훅
├── types/                      # TypeScript 타입
└── middleware.ts               # Next.js Edge 미들웨어
```

### 파일 배치 규칙

| 유형 | 위치 | 예시 |
| ---- | ---- | ---- |
| 페이지 | `app/(main)/[route]/page.tsx` | `app/(main)/dashboard/page.tsx` |
| API | `app/api/[path]/route.ts` | `app/api/ai/recommend/route.ts` |
| 도메인 컴포넌트 | `components/[domain]/` | `components/places/place-form.tsx` |
| UI 기초 컴포넌트 | `components/ui/` | `components/ui/button.tsx` |
| 외부 서비스 래퍼 | `lib/[service]/` | `lib/google-places/client.ts` |
| 타입 정의 | `types/` | `types/database.ts` |
| 전역 상태 | `stores/` | `stores/auth-store.ts` |
| 훅 | `hooks/` | `hooks/use-supabase.ts` |

---

## 3. 상태 관리 패턴

이 프로젝트는 4가지 상태 관리 방식을 사용합니다:

### 3.1 Zustand — 전역 상태

인증된 사용자 프로필만 저장. 최소한의 전역 상태.

```typescript
// 읽기
const user = useAuthStore((s) => s.user);

// 쓰기
const { setUser } = useAuthStore();
setUser(profile);       // 로그인 시
setUser(null);          // 로그아웃 시
```

### 3.2 React Query — 서버 데이터 캐싱

Supabase에서 가져온 데이터의 캐싱, 리페칭, 무효화 관리.

```typescript
// 데이터 조회
const { data: places, isLoading } = useQuery({
  queryKey: ["places", tripId],
  queryFn: async () => {
    const { data } = await supabase
      .from("places")
      .select("*")
      .eq("trip_id", tripId);
    return data;
  },
});

// 캐시 무효화 (데이터 변경 후)
queryClient.invalidateQueries({ queryKey: ["places", tripId] });
```

**설정**: staleTime 60초, retry 1회

### 3.3 Supabase Realtime — 실시간 동기화

`RealtimeProvider`가 DB 변경을 감지하고 React Query 캐시를 자동 무효화.

```typescript
// 자동 동작 — RealtimeProvider가 처리
// places 테이블 변경 → ["places", tripId] 캐시 무효화 → UI 자동 업데이트
```

### 3.4 로컬 상태 — 컴포넌트 내부

폼 입력, UI 토글 등 컴포넌트 내부 상태.

```typescript
const [isOpen, setIsOpen] = useState(false);
```

---

## 4. Supabase 사용 규칙

### 4.1 클라이언트 구분

| 상황 | import | 파일 |
| ---- | ------ | ---- |
| Client Component | `import { createClient } from "@/lib/supabase/client"` | `lib/supabase/client.ts` |
| Server Component / API Route | `import { createClient } from "@/lib/supabase/server"` | `lib/supabase/server.ts` |
| Middleware | `import { updateSession } from "@/lib/supabase/middleware"` | `lib/supabase/middleware.ts` |

> 혼용 금지. 클라이언트용 `createClient()`를 서버에서 사용하면 쿠키 접근 불가.

### 4.2 Custom Hook

```typescript
import { useSupabase } from "@/hooks/use-supabase";

function MyComponent() {
  const supabase = useSupabase();  // useMemo로 메모이제이션
  // ...
}
```

### 4.3 데이터 쿼리

```typescript
// 읽기
const { data } = await supabase
  .from("places")
  .select("*, place_votes(*)")
  .eq("trip_id", tripId)
  .order("created_at", { ascending: false });

// 쓰기
const { error } = await supabase
  .from("places")
  .insert({ trip_id: tripId, name, category, added_by: user.id });

// RPC 호출
const { data } = await supabase.rpc("create_trip_with_member", {
  p_title: title,
  p_destination: destination,
  // ...
});
```

---

## 5. API Route 작성 패턴

```typescript
// src/app/api/[feature]/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  // 1. 인증 확인
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. 입력 파싱 & 검증
  const body = await request.json();
  if (!body.trip_id) {
    return NextResponse.json({ error: "trip_id required" }, { status: 400 });
  }

  // 3. 권한 확인 (필요 시)
  const { data: member } = await supabase
    .from("trip_members")
    .select("role")
    .eq("trip_id", body.trip_id)
    .eq("user_id", user.id)
    .single();
  if (!member) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 4. 비즈니스 로직
  const { data, error } = await supabase.from("table").insert({...});
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 5. 응답
  return NextResponse.json({ success: true, data });
}
```

---

## 6. 컴포넌트 작성 규칙

### 6.1 파일 명명

- **컴포넌트**: `kebab-case.tsx` (예: `place-form.tsx`)
- **훅**: `use-[name].ts` (예: `use-supabase.ts`)
- **유틸**: `kebab-case.ts` (예: `url-parser.ts`)
- **타입**: `kebab-case.ts` (예: `database.ts`)

### 6.2 스타일링

Tailwind CSS 유틸리티 클래스 사용. `cn()` 유틸로 조건부 클래스 병합.

```typescript
import { cn } from "@/lib/utils";

<div className={cn(
  "flex items-center gap-2",
  isActive && "text-blue-600",
  className
)} />
```

### 6.3 반응형

| 화면 | 브레이크포인트 | 레이아웃 |
| ---- | ------------- | -------- |
| 모바일 | < 768px (기본) | BottomNav (하단 64px) |
| 데스크톱 | ≥ 768px (md:) | Sidebar (좌측 64px) |

```typescript
// 모바일 기본 → 데스크톱 오버라이드
<div className="pb-16 md:pb-0 md:pl-64">
```

### 6.4 UI 컴포넌트

shadcn/ui 기반. `components/ui/`에 위치.

```typescript
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
```

---

## 7. 네비게이션 구조

### 7.1 전역 네비 (4탭)

| 탭 | 경로 | 아이콘 |
| -- | ---- | ------ |
| 내 여행 | `/dashboard` | Home |
| 탐색 | `/explore` | Compass |
| 알림 | `/notifications` | Bell |
| 내 정보 | `/profile` | User |

### 7.2 여행별 탭 (5탭)

| 탭 | 경로 | 아이콘 |
| -- | ---- | ------ |
| 장소 | `/trips/[id]/places` | MapPin |
| 일정 | `/trips/[id]/schedule` | Calendar |
| 예산 | `/trips/[id]/budget` | Wallet |
| 후기 | `/trips/[id]/journal` | BookOpen |
| 멤버 | `/trips/[id]/members` | Users |

네비 항목은 `src/config/navigation.ts`에서 중앙 관리.

---

## 8. 새 기능 추가 워크플로

### 8.1 문서 먼저

1. `docs/plans/[feature]/plan-[feature]-[date].md` 작성 (템플릿: `docs/templates/plan.md`)
2. PRD에 기능 추가 (상태: 🟡)
3. TASKS.md 백로그에 추가

### 8.2 구현

1. 타입 정의 (`types/database.ts`)
2. DB 마이그레이션 (`supabase/migrations/`)
3. API Route (필요 시)
4. 컴포넌트 구현
5. Realtime 구독 추가 (필요 시)

### 8.3 완료 처리

1. TASKS.md: 백로그 → 완료됨 이동
2. PRD: 상태 ✅로 변경
3. 계획 문서 → `docs/archive/`로 이동

---

## 9. DB 마이그레이션

### 9.1 파일 위치

```
supabase/migrations/
└── 20260311_add_enrichment_fields.sql
```

### 9.2 명명 규칙

```
YYYYMMDD_[설명].sql
```

### 9.3 적용

```bash
# Supabase CLI로 적용
supabase db push

# 타입 재생성 (향후)
supabase gen types typescript --local > src/types/supabase.ts
```

---

## 10. 자주 묻는 질문

### Supabase 클라이언트 에러가 나요

- Client Component에서 `lib/supabase/server` import 하면 안 됩니다.
- `"use client"` 컴포넌트에서는 `lib/supabase/client` 또는 `useSupabase()` 사용.

### Realtime이 동작하지 않아요

- `RealtimeProvider`가 해당 페이지를 감싸고 있는지 확인.
- Supabase 대시보드에서 Realtime이 활성화되어 있는지 확인.
- RLS 정책이 SELECT를 허용하는지 확인.

### Google Maps가 안 보여요

- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` 환경변수 확인.
- Google Cloud Console에서 Maps JavaScript API, Places API 활성화 확인.
- 도메인 제한 설정 확인 (localhost 허용).

### AI가 응답하지 않아요

- `GEMINI_API_KEY` 환경변수 확인.
- Google AI Studio에서 API 키 상태 확인.
- 무료 티어 한도(분당 요청 수) 확인.
