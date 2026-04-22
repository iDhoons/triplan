# Offline-First PWA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 네트워크가 끊기거나 느린 환경에서도 여행 일정/장소/체크리스트 조회 및 편집이 가능한 오프라인-퍼스트 PWA 구축

**Architecture:** 3계층 오프라인 아키텍처 — Layer 1: TanStack Query + IndexedDB 영속화로 앱 재시작 시 데이터 즉시 복원, Layer 2: Serwist BackgroundSyncQueue + React Query paused mutations로 오프라인 변경사항 자동 동기화, Layer 3: SW 캐시 전략 강화로 사진/정적자산 오프라인 제공

**Tech Stack:** @tanstack/react-query-persist-client, idb-keyval, Serwist BackgroundSyncQueue, IndexedDB

---

## 현황 분석

### 현재 데이터 흐름

| Hook | Query Key | 데이터 소스 | staleTime | gcTime | 오프라인 시 |
|------|-----------|-----------|-----------|--------|------------|
| `useTrips` | `["trips"]` | Supabase `trip_members` | 5분 | 10분(기본) | 캐시 만료 후 빈 화면 |
| `useTrip` | `["trip", id]` | Supabase `trips` | 5분(기본) | 10분(기본) | 동일 |
| `usePlaces` | `["places", id]` | Supabase `places` | 5분(기본) | 10분(기본) | 동일 |
| `useScheduleData` | `["schedule-data", id]` | Supabase 3테이블 병렬 | 5분(기본) | 10분(기본) | 동일 |
| `useChecklist` | `["checklist", id]` | Supabase `checklist_items` | 5분(기본) | 10분(기본) | 동일 |
| `useNotifications` | `["notifications", "feed"]` | `/api/notifications` | 15초 | 10분(기본) | 동일 |
| `useNotificationCount` | `["notifications", "count"]` | `/api/notifications/count` | 10초 | 10분(기본) | 30초 polling 실패 |
| `useTripStats` | `["trip-stats", id]` | `/api/trips/{id}/stats` | 30초 | 10분(기본) | 동일 |
| `useChecklistStats` | `["checklist-stats", id]` | API | 30초 | 10분(기본) | 동일 |
| `useTripActivity` | `["activity_logs", id]` | Supabase `activity_logs` | 15초 | 10분(기본) | 동일 |
| `useTripMembers` | `["members", id]` | Supabase `trip_members` | 5분(기본) | 10분(기본) | 동일 |

### Mutation 현황

| Hook | Mutation | 낙관적 업데이트 | 롤백 | 오프라인 |
|------|----------|---------------|-------|---------|
| `useChecklist.addItem` | Supabase insert | O (임시 ID) | O | 실패 |
| `useChecklist.toggleCheck` | Supabase RPC | O | O | 실패 |
| `useChecklist.reorderItems` | Supabase RPC | O | O | 실패 |
| `useChecklist.updateItem` | Supabase update | O | O | 실패 |
| `useChecklist.deleteItem` | Supabase delete | O | O | 실패 |
| `useScheduleActions.handleFormSubmit` | Supabase insert/update | **X** | **X** | 실패 |
| `useScheduleActions.handleDelete` | Supabase delete | **X** | **X** | 실패 |
| `useNotifications.markAsRead` | API PATCH | **X** | **X** | 실패 |

### Service Worker 캐시 현황

| 대상 | 전략 | 캐시 유지 | 문제점 |
|------|------|-----------|--------|
| `/api/*` | NetworkFirst (10초) | 무제한 | 오프라인 10초 대기 후 캐시 |
| `*.supabase.co` | NetworkFirst (10초) | 무제한 | 동일 |
| 이미지 확장자 | CacheFirst | 100개/30일 | Google Places URL 매칭 안됨 |
| 폰트/CSS | StaleWhileRevalidate | 무제한 | 양호 |
| 페이지 | NetworkFirst (3초) | 무제한 | offline fallback 있음 |

### 누락된 패키지

- `@tanstack/react-query-persist-client` — Query 캐시 영속화
- `@tanstack/query-async-storage-persister` — 비동기 스토리지 persister
- `idb-keyval` — IndexedDB 래퍼

---

## File Structure

```
src/
├── app/
│   ├── providers.tsx              # MODIFY: PersistQueryClientProvider 전환
│   └── sw.ts                      # MODIFY: 사진 캐싱, BackgroundSyncQueue 추가
├── components/
│   ├── layout/
│   │   ├── offline-banner.tsx     # CREATE: 오프라인 상태 배너
│   │   └── sync-status.tsx        # CREATE: 동기화 상태 표시
│   └── realtime/
│       └── realtime-provider.tsx  # MODIFY: 오프라인 감지 로직
├── hooks/
│   ├── use-online-status.ts       # CREATE: 네트워크 상태 훅
│   ├── use-schedule-actions.ts    # MODIFY: useMutation 전환 + 낙관적 업데이트
│   └── use-sync-queue.ts          # CREATE: 오프라인 동기화 큐
├── lib/
│   ├── persister.ts               # CREATE: IndexedDB persister
│   └── offline-queue.ts           # CREATE: 오프라인 mutation 큐 매니저
└── stores/
    └── sync-store.ts              # CREATE: 동기화 상태 Zustand 스토어
```

---

## Phase 1: 데이터 영속화 (TanStack Query + IndexedDB)

### Task 1.1: 패키지 설치

**Files:**
- Modify: `package.json`

- [ ] **Step 1: 패키지 설치**

```bash
pnpm add @tanstack/react-query-persist-client @tanstack/query-async-storage-persister idb-keyval
```

- [ ] **Step 2: 설치 확인**

```bash
pnpm ls @tanstack/react-query-persist-client @tanstack/query-async-storage-persister idb-keyval
```

Expected: 3개 패키지 버전 표시

- [ ] **Step 3: 커밋**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add offline persistence dependencies"
```

---

### Task 1.2: IndexedDB Persister 생성

**Files:**
- Create: `src/lib/persister.ts`

- [ ] **Step 1: IDB persister 구현**

```typescript
// src/lib/persister.ts
import { get, set, del } from "idb-keyval"
import type { PersistedClient, Persister } from "@tanstack/react-query-persist-client"

export function createIDBPersister(idbValidKey: IDBValidKey = "triplan-query-cache"): Persister {
  return {
    persistClient: async (client: PersistedClient) => {
      await set(idbValidKey, client)
    },
    restoreClient: async () => {
      return await get<PersistedClient>(idbValidKey)
    },
    removeClient: async () => {
      await del(idbValidKey)
    },
  }
}
```

- [ ] **Step 2: 타입 체크**

```bash
pnpm tsc --noEmit src/lib/persister.ts
```

Expected: 에러 없음

- [ ] **Step 3: 커밋**

```bash
git add src/lib/persister.ts
git commit -m "feat(offline): add IndexedDB persister for TanStack Query"
```

---

### Task 1.3: Providers를 PersistQueryClientProvider로 전환

**Files:**
- Modify: `src/app/providers.tsx`

현재 `providers.tsx`는 `QueryClientProvider` 사용. 이를 `PersistQueryClientProvider`로 교체.

- [ ] **Step 1: providers.tsx 수정**

```typescript
// src/app/providers.tsx
"use client"

import { useState, type ReactNode } from "react"
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client"
import { Toaster } from "@/components/ui/sonner"
import { ServiceWorkerRegister } from "@/components/layout/sw-register"
import { InstallBanner } from "@/components/layout/install-banner"
import { createIDBPersister } from "@/lib/persister"

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000,
            gcTime: 1000 * 60 * 60 * 24, // 24시간 (영속화용)
            retry: 1,
            networkMode: "offlineFirst",
          },
          mutations: {
            networkMode: "offlineFirst",
          },
        },
      })
  )

  // splash screen 처리
  // ... 기존 useEffect 유지

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: createIDBPersister(),
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7일
        dehydrateOptions: {
          shouldDehydrateQuery: (query) => {
            // notifications, stats 등 휘발성 데이터는 영속화 제외
            const key = query.queryKey[0] as string
            const skipKeys = ["notifications", "trip-stats", "checklist-stats", "activity_logs"]
            return !skipKeys.includes(key)
          },
        },
      }}
      onSuccess={() => {
        queryClient.resumePausedMutations()
      }}
    >
      {children}
      <Toaster />
      <ServiceWorkerRegister />
      <InstallBanner />
    </PersistQueryClientProvider>
  )
}
```

**핵심 변경점:**
- `QueryClientProvider` → `PersistQueryClientProvider`
- `gcTime`: 10분 → 24시간
- `networkMode: "offlineFirst"` 추가 (쿼리 + 뮤테이션)
- `shouldDehydrateQuery`: 휘발성 데이터(notifications, stats, activity)는 IDB에 저장하지 않음
- `onSuccess`: 앱 시작 시 paused mutations 자동 재생

- [ ] **Step 2: 빌드 확인**

```bash
pnpm build 2>&1 | tail -20
```

Expected: 빌드 성공

- [ ] **Step 3: 커밋**

```bash
git add src/app/providers.tsx
git commit -m "feat(offline): switch to PersistQueryClientProvider with IndexedDB persistence"
```

---

### Task 1.4: 기존 gcTime 오버라이드 제거

**Files:**
- Modify: `src/hooks/use-notification-count.ts`
- Modify: `src/hooks/use-trip-activity.ts`
- Modify: `src/hooks/use-trip-stats.ts`
- Modify: `src/hooks/use-checklist-stats.ts`
- Modify: `src/hooks/use-trips.ts`
- Modify: `src/hooks/use-notifications.ts`

현재 각 훅에서 개별 staleTime을 설정. `networkMode: "offlineFirst"` 도입 후에는:
- staleTime 유지 (기존 동작 보존)
- gcTime 오버라이드 불필요 (글로벌 24시간)
- notifications/stats는 영속화 제외되므로 기존 gcTime 유지

- [ ] **Step 1: 각 훅에 networkMode 명시적 설정 불필요 확인**

글로벌 `networkMode: "offlineFirst"`가 모든 쿼리에 적용되므로, 개별 훅 수정 없이 그대로 사용.
다만 `refetchInterval`이 있는 훅(`useNotificationCount`)은 오프라인 시 불필요한 에러 방지 필요.

`use-notification-count.ts`만 수정:

```typescript
// src/hooks/use-notification-count.ts — refetchInterval 조건부 활성화
return useQuery({
  queryKey: queryKeys.notifications.count,
  queryFn: async (): Promise<number> => {
    const res = await fetch("/api/notifications/count")
    if (!res.ok) return 0
    const json = await res.json()
    return json.unread_count ?? 0
  },
  refetchInterval: navigator.onLine ? 30_000 : false,
  refetchIntervalInBackground: false,
  staleTime: 10_000,
  enabled: !!user?.id,
})
```

- [ ] **Step 2: 타입체크**

```bash
pnpm tsc --noEmit 2>&1 | head -20
```

Expected: 에러 없음

- [ ] **Step 3: 커밋**

```bash
git add src/hooks/use-notification-count.ts
git commit -m "fix(offline): disable notification polling when offline"
```

---

## Phase 2: 사진 캐싱 수정

### Task 2.1: Service Worker 사진 캐싱 라우트 추가

**Files:**
- Modify: `src/app/sw.ts`

현재 이미지 매칭이 `/\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/` 확장자 기반. Google Places 사진 proxy URL(`/api/places/photo?name=...`)은 매칭되지 않음.

- [ ] **Step 1: sw.ts에 사진 API 캐싱 라우트 추가**

`runtimeCaching` 배열의 이미지 매칭 **앞에** 추가 (순서 중요):

```typescript
// src/app/sw.ts — runtimeCaching 배열 맨 앞에 추가

// Google Places photo proxy — CacheFirst (오프라인에서 사진 표시)
{
  matcher: ({ url }) => url.pathname.startsWith("/api/places/photo"),
  handler: new CacheFirst({
    cacheName: "place-photos",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 200,
        maxAgeSeconds: 7 * 24 * 60 * 60, // 7일
      }),
    ],
  }),
  method: "GET",
},
// weather API — CacheFirst (날씨 데이터 캐싱)
{
  matcher: ({ url }) => url.pathname === "/api/weather",
  handler: new CacheFirst({
    cacheName: "weather-cache",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 3 * 60 * 60, // 3시간
      }),
    ],
  }),
  method: "GET",
},
// directions API — CacheFirst (경로 캐싱)
{
  matcher: ({ url }) => url.pathname === "/api/directions",
  handler: new CacheFirst({
    cacheName: "directions-cache",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 24 * 60 * 60, // 24시간
      }),
    ],
  }),
  method: "GET",
},
```

기존 이미지 매칭 regex도 수정 — URL 파라미터 포함 이미지도 캐시:

```typescript
// 기존
// matcher: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/,
// 수정: 쿼리 파라미터가 있는 이미지 URL도 매칭
{
  matcher: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)(\?.*)?$/,
  handler: new CacheFirst({
    cacheName: "image-cache",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 200,
        maxAgeSeconds: 30 * 24 * 60 * 60,
      }),
    ],
  }),
},
```

- [ ] **Step 2: 빌드 확인**

```bash
pnpm build 2>&1 | tail -10
```

- [ ] **Step 3: 커밋**

```bash
git add src/app/sw.ts
git commit -m "feat(offline): add photo, weather, directions caching in service worker"
```

---

### Task 2.2: cacheOnNavigation 활성화

**Files:**
- Modify: `next.config.ts`

- [ ] **Step 1: next.config.ts에 cacheOnNavigation 추가**

`withSerwistInit` 호출부에 `cacheOnNavigation: true` 추가:

```typescript
// next.config.ts — withSerwistInit 호출 수정
const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  cacheOnNavigation: true,
  disable: process.env.NODE_ENV !== "production",
})
```

- [ ] **Step 2: 빌드 확인**

```bash
pnpm build 2>&1 | tail -10
```

- [ ] **Step 3: 커밋**

```bash
git add next.config.ts
git commit -m "feat(offline): enable cacheOnNavigation for instant page loads"
```

---

## Phase 3: 오프라인 Mutation 큐

### Task 3.1: 네트워크 상태 훅 생성

**Files:**
- Create: `src/hooks/use-online-status.ts`
- Create: `src/stores/sync-store.ts`

- [ ] **Step 1: 온라인 상태 훅**

```typescript
// src/hooks/use-online-status.ts
"use client"

import { useSyncExternalStore } from "react"

function getSnapshot() {
  return navigator.onLine
}

function getServerSnapshot() {
  return true
}

function subscribe(callback: () => void) {
  window.addEventListener("online", callback)
  window.addEventListener("offline", callback)
  return () => {
    window.removeEventListener("online", callback)
    window.removeEventListener("offline", callback)
  }
}

export function useOnlineStatus() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
```

- [ ] **Step 2: 동기화 상태 스토어**

```typescript
// src/stores/sync-store.ts
import { create } from "zustand"

interface PendingAction {
  id: string
  type: string
  payload: unknown
  timestamp: number
  status: "pending" | "syncing" | "failed"
}

interface SyncState {
  pendingActions: PendingAction[]
  isSyncing: boolean
  lastSyncedAt: Date | null
  addPendingAction: (action: Omit<PendingAction, "id" | "timestamp" | "status">) => void
  removePendingAction: (id: string) => void
  setActionStatus: (id: string, status: PendingAction["status"]) => void
  setSyncing: (syncing: boolean) => void
  setLastSyncedAt: (date: Date) => void
  pendingCount: () => number
}

export const useSyncStore = create<SyncState>((set, get) => ({
  pendingActions: [],
  isSyncing: false,
  lastSyncedAt: null,

  addPendingAction: (action) =>
    set((state) => ({
      pendingActions: [
        ...state.pendingActions,
        { ...action, id: crypto.randomUUID(), timestamp: Date.now(), status: "pending" as const },
      ],
    })),

  removePendingAction: (id) =>
    set((state) => ({
      pendingActions: state.pendingActions.filter((a) => a.id !== id),
    })),

  setActionStatus: (id, status) =>
    set((state) => ({
      pendingActions: state.pendingActions.map((a) => (a.id === id ? { ...a, status } : a)),
    })),

  setSyncing: (syncing) => set({ isSyncing: syncing }),
  setLastSyncedAt: (date) => set({ lastSyncedAt: date }),

  pendingCount: () => get().pendingActions.filter((a) => a.status === "pending").length,
}))
```

- [ ] **Step 3: 타입체크**

```bash
pnpm tsc --noEmit 2>&1 | head -10
```

- [ ] **Step 4: 커밋**

```bash
git add src/hooks/use-online-status.ts src/stores/sync-store.ts
git commit -m "feat(offline): add online status hook and sync store"
```

---

### Task 3.2: Service Worker BackgroundSyncQueue 설정

**Files:**
- Modify: `src/app/sw.ts`

- [ ] **Step 1: BackgroundSyncQueue 추가**

```typescript
// src/app/sw.ts — Serwist 설정 뒤에 추가
import { BackgroundSyncQueue } from "serwist"

// 오프라인 mutation 큐
const mutationQueue = new BackgroundSyncQueue("offline-mutations", {
  maxRetentionTime: 24 * 60, // 24시간
})

// 오프라인 mutation 엔드포인트 인터셉트
self.addEventListener("fetch", (event) => {
  const { request } = event
  if (request.method !== "POST" && request.method !== "PATCH" && request.method !== "DELETE") {
    return
  }
  if (!request.url.includes("/api/offline-mutation")) {
    return
  }

  const handleRequest = async () => {
    try {
      const response = await fetch(request.clone())
      // 성공 시 클라이언트에 알림
      const client = await self.clients.get(event.clientId || "")
      if (client) {
        client.postMessage({ type: "SYNC_COMPLETE", url: request.url })
      }
      return response
    } catch {
      await mutationQueue.pushRequest({ request: request.clone() })
      return new Response(JSON.stringify({ queued: true, queueSize: await mutationQueue.size() }), {
        headers: { "Content-Type": "application/json" },
      })
    }
  }

  event.respondWith(handleRequest())
})
```

- [ ] **Step 2: 빌드 확인**

```bash
pnpm build 2>&1 | tail -10
```

- [ ] **Step 3: 커밋**

```bash
git add src/app/sw.ts
git commit -m "feat(offline): add BackgroundSyncQueue for offline mutations"
```

---

### Task 3.3: Schedule Actions를 useMutation으로 전환

**Files:**
- Modify: `src/hooks/use-schedule-actions.ts`

현재 `use-schedule-actions.ts`는 `async function` + `toast` 패턴. `networkMode: "offlineFirst"`와 `resumePausedMutations`가 작동하려면 `useMutation`으로 전환 필요.

- [ ] **Step 1: handleFormSubmit을 useMutation으로 전환**

```typescript
// src/hooks/use-schedule-actions.ts — 주요 변경점

// 기존: async function 직접 호출
// 변경: useMutation + optimistic update

const createScheduleItem = useMutation({
  mutationFn: async (data: ScheduleItemFormData) => {
    const supabase = createClient()
    const payload = buildPayload(data)
    const { error } = await supabase.from("schedule_items").insert(payload)
    if (error) throw error
  },
  onMutate: async (data) => {
    await queryClient.cancelQueries({ queryKey: queryKeys.schedules.data(tripId) })
    const previous = queryClient.getQueryData(queryKeys.schedules.data(tripId))

    // 낙관적 업데이트: 임시 항목 추가
    queryClient.setQueryData(queryKeys.schedules.data(tripId), (old: any) => {
      if (!old) return old
      const tempItem = {
        id: `temp-${crypto.randomUUID()}`,
        ...buildPayload(data),
        place: null,
      }
      return {
        ...old,
        schedules: old.schedules?.map((s: any) =>
          s.date === data.date
            ? { ...s, items: [...(s.items || []), tempItem] }
            : s
        ),
      }
    })

    return { previous }
  },
  onError: (_err, _vars, context) => {
    if (context?.previous) {
      queryClient.setQueryData(queryKeys.schedules.data(tripId), context.previous)
    }
    toast.error("저장에 실패했습니다")
  },
  onSuccess: () => {
    invalidateSchedules()
  },
})

const updateScheduleItem = useMutation({
  mutationFn: async ({ id, data }: { id: string; data: ScheduleItemFormData }) => {
    const supabase = createClient()
    const payload = buildPayload(data)
    const { error } = await supabase
      .from("schedule_items")
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq("id", id)
    if (error) throw error
  },
  onMutate: async ({ id, data }) => {
    await queryClient.cancelQueries({ queryKey: queryKeys.schedules.data(tripId) })
    const previous = queryClient.getQueryData(queryKeys.schedules.data(tripId))

    queryClient.setQueryData(queryKeys.schedules.data(tripId), (old: any) => {
      if (!old) return old
      return {
        ...old,
        schedules: old.schedules?.map((s: any) => ({
          ...s,
          items: s.items?.map((item: any) =>
            item.id === id ? { ...item, ...buildPayload(data) } : item
          ),
        })),
      }
    })

    return { previous }
  },
  onError: (_err, _vars, context) => {
    if (context?.previous) {
      queryClient.setQueryData(queryKeys.schedules.data(tripId), context.previous)
    }
    toast.error("저장에 실패했습니다")
  },
  onSuccess: () => {
    invalidateSchedules()
  },
})

const deleteScheduleItem = useMutation({
  mutationFn: async (id: string) => {
    const supabase = createClient()
    const { error } = await supabase.from("schedule_items").delete().eq("id", id)
    if (error) throw error
  },
  onMutate: async (id) => {
    await queryClient.cancelQueries({ queryKey: queryKeys.schedules.data(tripId) })
    const previous = queryClient.getQueryData(queryKeys.schedules.data(tripId))

    queryClient.setQueryData(queryKeys.schedules.data(tripId), (old: any) => {
      if (!old) return old
      return {
        ...old,
        schedules: old.schedules?.map((s: any) => ({
          ...s,
          items: s.items?.filter((item: any) => item.id !== id),
        })),
      }
    })

    return { previous }
  },
  onError: (_err, _vars, context) => {
    if (context?.previous) {
      queryClient.setQueryData(queryKeys.schedules.data(tripId), context.previous)
    }
    toast.error("삭제에 실패했습니다")
  },
  onSuccess: () => {
    invalidateSchedules()
  },
})
```

- [ ] **Step 2: handleFormSubmit/handleDelete를 mutation.mutate로 교체**

기존 `handleFormSubmit` 호출부를 `createScheduleItem.mutate(data)` 또는 `updateScheduleItem.mutate({ id, data })`로 교체.
기존 `handleDelete` 호출부를 `deleteScheduleItem.mutate(id)`로 교체.

- [ ] **Step 3: 호출부 컴포넌트 확인 및 수정**

`src/components/schedule/schedule-item-form.tsx`와 `src/components/schedule/planner-view.tsx`에서 기존 함수 시그니처에 맞게 수정.

- [ ] **Step 4: 타입체크 + 빌드**

```bash
pnpm tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 5: 커밋**

```bash
git add src/hooks/use-schedule-actions.ts src/components/schedule/
git commit -m "refactor(schedule): convert to useMutation with optimistic updates"
```

---

## Phase 4: 오프라인 UI

### Task 4.1: 오프라인 배너 컴포넌트

**Files:**
- Create: `src/components/layout/offline-banner.tsx`
- Modify: `src/components/layout/app-shell.tsx` 또는 레이아웃 컴포넌트

- [ ] **Step 1: OfflineBanner 컴포넌트**

```typescript
// src/components/layout/offline-banner.tsx
"use client"

import { useOnlineStatus } from "@/hooks/use-online-status"
import { useSyncStore } from "@/stores/sync-store"
import { WifiOff, CloudOff, CheckCircle2 } from "lucide-react"
import { AnimatePresence, motion } from "framer-motion"

export function OfflineBanner() {
  const isOnline = useOnlineStatus()
  const pendingCount = useSyncStore((s) => s.pendingCount())
  const isSyncing = useSyncStore((s) => s.isSyncing)

  return (
    <AnimatePresence>
      {!isOnline && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="bg-amber-500 text-white text-sm text-center py-1.5 px-4 flex items-center justify-center gap-2"
        >
          <WifiOff className="w-4 h-4" />
          <span>오프라인 모드 — 변경사항은 연결 복구 시 동기화됩니다</span>
          {pendingCount > 0 && (
            <span className="bg-amber-700 rounded-full px-2 py-0.5 text-xs">
              {pendingCount}개 대기
            </span>
          )}
        </motion.div>
      )}
      {isOnline && isSyncing && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="bg-blue-500 text-white text-sm text-center py-1.5 px-4 flex items-center justify-center gap-2"
        >
          <CloudOff className="w-4 h-4 animate-pulse" />
          <span>동기화 중...</span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
```

> **참고:** framer-motion이 없다면 CSS transition으로 대체. tailwind `transition-all` + conditional classes 사용.

- [ ] **Step 2: 레이아웃에 배너 삽입**

AppShell 또는 최상위 레이아웃의 `<header>` 바로 위에 `<OfflineBanner />` 배치.

- [ ] **Step 3: 타입체크**

```bash
pnpm tsc --noEmit 2>&1 | head -10
```

- [ ] **Step 4: 커밋**

```bash
git add src/components/layout/offline-banner.tsx
git commit -m "feat(offline): add offline status banner component"
```

---

### Task 4.2: 동기화 상태 표시 (선택)

**Files:**
- Create: `src/components/layout/sync-status.tsx`

- [ ] **Step 1: SyncStatus 인디케이터**

하단 네비게이션 또는 사이드바에 작은 동기화 아이콘 표시.

```typescript
// src/components/layout/sync-status.tsx
"use client"

import { useSyncStore } from "@/stores/sync-store"
import { useOnlineStatus } from "@/hooks/use-online-status"
import { Cloud, CloudOff, Loader2 } from "lucide-react"

export function SyncStatus() {
  const isOnline = useOnlineStatus()
  const isSyncing = useSyncStore((s) => s.isSyncing)
  const pendingCount = useSyncStore((s) => s.pendingCount())

  if (!isOnline) {
    return (
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <CloudOff className="w-3.5 h-3.5 text-amber-500" />
        <span>오프라인</span>
        {pendingCount > 0 && <span>({pendingCount})</span>}
      </div>
    )
  }

  if (isSyncing) {
    return (
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
        <span>동기화 중</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1 text-xs text-muted-foreground">
      <Cloud className="w-3.5 h-3.5 text-green-500" />
      <span>동기화됨</span>
    </div>
  )
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/components/layout/sync-status.tsx
git commit -m "feat(offline): add sync status indicator component"
```

---

## Phase 5: Realtime 오프라인 복구

### Task 5.1: Realtime Provider 오프라인 감지

**Files:**
- Modify: `src/components/realtime/realtime-provider.tsx`

- [ ] **Step 1: subscribe 상태 콜백에 오프라인 처리 추가**

```typescript
// src/components/realtime/realtime-provider.tsx — subscribe 콜백 수정

.subscribe(async (status) => {
  const currentUser = userRef.current

  if (status === "SUBSCRIBED" && currentUser) {
    await channel.track({
      userId: currentUser.id,
      displayName: currentUser.display_name,
      avatarUrl: currentUser.avatar_url,
      onlineAt: new Date().toISOString(),
    })
    // 온라인 복구 시 캐시 리페치
    queryClient.invalidateQueries({ queryKey: queryKeys.schedules.data(tripId) })
    queryClient.invalidateQueries({ queryKey: queryKeys.places.byTrip(tripId) })
    queryClient.invalidateQueries({ queryKey: queryKeys.checklist.byTrip(tripId) })
  }

  if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
    // 재연결 시도는 Supabase가 자동 처리
    // 콘솔에 로깅만
    console.warn(`[Realtime] channel status: ${status}`)
  }
})
```

- [ ] **Step 2: 타입체크**

```bash
pnpm tsc --noEmit 2>&1 | head -10
```

- [ ] **Step 3: 커밋**

```bash
git add src/components/realtime/realtime-provider.tsx
git commit -m "feat(offline): refresh cache on Realtime reconnection"
```

---

## Phase 6: 통합 테스트 및 검증

### Task 6.1: 오프라인 시나리오 수동 테스트

- [ ] **Step 1: DevTools 오프라인 모드에서 시나리오 테스트**

1. 여행 목록 로드 → 오프라인 전환 → 앱 새로고침 → 목록 유지 확인
2. 여행 일정 페이지 로드 → 오프라인 전환 → 일정 편집 → 온라인 복귀 → 동기화 확인
3. 체크리스트 토글 → 오프라인 → 토글 → 온라인 복귀 → 서버 반영 확인
4. 장소 사진이 캐시된 상태에서 오프라인 → 사진 표시 확인
5. 날씨 데이터 캐시된 상태에서 오프라인 → 날씨 표시 확인

- [ ] **Step 2: 모바일 PWA 테스트**

1. 홈 화면 추가 → 앱 종료 → 오프라인 상태에서 실행 → 캐시된 데이터 표시
2. 오프라인에서 체크리스트 수정 → 온라인 전환 → 자동 동기화

### Task 6.2: 빌드 및 배포 검증

- [ ] **Step 1: 프로덕션 빌드**

```bash
pnpm build
```

- [ ] **Step 2: Lighthouse PWA 감사**

Chrome DevTools → Lighthouse → PWA 카테고리 실행. 목표: 90점 이상.

- [ ] **Step 3: 최종 커밋**

```bash
git add -A
git commit -m "feat(offline): complete offline-first PWA implementation"
```

---

## Not Doing (이번 구현에서 제외)

| 항목 | 이유 |
|------|------|
| CRDT 기반 충돌 해결 | 복잡도 대비 효용 낮음 — last-write-wins로 충분 |
| IndexedDB에 전체 DB 미러링 | Supabase가 Source of Truth — 캐시는 React Query로 충분 |
| 오프라인에서 장소 검색 | Google Places API 필수 — 키워드 매칭 검색은 별도 기능 |
| Push Notification 오프라인 큐 | 기존 SW push 핸들러로 충분 |
| Progressive Loading skeleton | UI 개선이지 오프라인 필수 아님 |
| Service Worker 개발 모드 활성화 | 디버깅 복잡도 증가 — 프로덕션만 지원 |

---

## 의존성 정리

```
Phase 1 (영속화)
  └─ Task 1.1 (패키지 설치)
  └─ Task 1.2 (Persister) → 1.1 선행
  └─ Task 1.3 (Providers) → 1.2 선행
  └─ Task 1.4 (gcTime 정리) → 1.3 선행

Phase 2 (SW 캐싱) ← Phase 1 독립, 병렬 가능
  └─ Task 2.1 (사진 캐싱)
  └─ Task 2.2 (cacheOnNavigation)

Phase 3 (Mutation 큐) ← Phase 1 선행 필요
  └─ Task 3.1 (상태 훅)
  └─ Task 3.2 (SW BackgroundSync) ← 3.1 독립
  └─ Task 3.3 (Schedule mutation 전환) ← 1.3 선행

Phase 4 (UI) ← Phase 3.1 선행
  └─ Task 4.1 (배너) → 3.1 선행
  └─ Task 4.2 (상태 표시) → 3.1 선행

Phase 5 (Realtime 복구) ← Phase 1 선행
  └─ Task 5.1

Phase 6 (검증) ← 모든 Phase 완료 후
```
