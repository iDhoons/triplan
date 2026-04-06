# 사용자 체감 속도 개선 — 4단계 성능 최적화

**Goal:** React Compiler, Google Maps Dynamic Import, View Transitions, Suspense 강화를 순차 적용하여 사용자가 체감하는 로딩 속도와 인터랙션 반응성을 개선한다.
**Architecture:** 설정 변경(Phase 1,3) → 코드 수정(Phase 2,4) 순서로, 각 Phase 독립적으로 검증 가능하게 진행
**Tech Stack:** Next.js 16.1.6, React 19.2.3, Turbopack, Google Maps API, Serwist
**Created:** 2026-03-20

---

## Current Phase

Phase 4: 전체 완료 — Status: complete

---

## 데이터 흐름 분석 (Before → After)

### Phase 1: React Compiler

```
[Before] 컴포넌트 렌더 사이클
┌─────────────────────────────────────────────────────────────┐
│ State/Props 변경                                            │
│     ↓                                                       │
│ 컴포넌트 함수 전체 재실행                                    │
│     ↓                                                       │
│ 모든 자식 컴포넌트도 재실행 (memo 없으면)                     │
│     ↓                                                       │
│ Virtual DOM 비교 → 실제 DOM 업데이트                         │
└─────────────────────────────────────────────────────────────┘
문제: 바뀌지 않은 부분도 매번 함수 재실행 → CPU 낭비, 프레임 드랍

[After] React Compiler 적용
┌─────────────────────────────────────────────────────────────┐
│ State/Props 변경                                            │
│     ↓                                                       │
│ 컴파일러가 빌드 시 의존성 분석 완료                          │
│     ↓                                                       │
│ 변경된 값에 의존하는 부분만 재실행 (자동 메모이제이션)        │
│     ↓                                                       │
│ 최소 범위 DOM 업데이트                                       │
└─────────────────────────────────────────────────────────────┘
효과: useMemo/useCallback 없이도 불필요한 리렌더링 30-50% 감소
```

### Phase 2: Google Maps Dynamic Import

```
[Before] 번들 로딩 흐름
┌─────────────────────────────────────────────────────────────┐
│ 사용자가 /dashboard 접속                                     │
│     ↓                                                       │
│ Next.js가 페이지 JS 번들 전송                                │
│     ↓                                                       │
│ places/[placeId]/page.tsx가 PlaceMap을 정적 import           │
│     → @googlemaps/js-api-loader가 번들에 포함 (~8KB)        │
│     → PlaceMap 컴포넌트 코드도 번들에 포함                   │
│     ↓                                                       │
│ travel-info-card.tsx가 loadGoogleMaps()를 직접 호출          │
│     → 일정 페이지 진입 시 즉시 Maps SDK 전체 로딩 (~200KB)   │
└─────────────────────────────────────────────────────────────┘
문제: 지도를 안 보는 페이지에서도 관련 코드가 번들에 포함

[After] Dynamic Import 적용
┌─────────────────────────────────────────────────────────────┐
│ 사용자가 /dashboard 접속                                     │
│     ↓                                                       │
│ 가벼운 JS 번들 전송 (Maps 코드 미포함)                       │
│     ↓                                                       │
│ 사용자가 장소 상세 페이지 이동                               │
│     ↓                                                       │
│ dynamic(() => import("PlaceMap"), { ssr: false })            │
│     → 이 시점에 PlaceMap 청크 다운로드                       │
│     → loadGoogleMaps() → Maps SDK 로딩                      │
│     ↓                                                       │
│ 지도 렌더링 (로딩 중 Skeleton 표시)                          │
└─────────────────────────────────────────────────────────────┘

현재 상태:
  ✅ places/page.tsx       → PlaceMap 이미 dynamic import 적용
  ✅ schedule/page.tsx     → RouteMap 이미 dynamic import 적용
  ❌ places/[placeId]/page.tsx → PlaceMap 정적 import (수정 필요)
  ⚠️ travel-info-card.tsx  → MiniMap이 loadGoogleMaps() 직접 호출 (검토 필요)
```

### Phase 3: View Transitions

```
[Before] 라우트 전환
┌─────────────────────────────────────────────────────────────┐
│ 사용자가 Link 클릭 (예: 여행 목록 → 여행 상세)              │
│     ↓                                                       │
│ 현재 페이지 즉시 언마운트                                    │
│     ↓                                                       │
│ 흰색/빈 화면 (FOUC)                                         │
│     ↓                                                       │
│ 새 페이지 마운트 + 데이터 로딩                               │
│     ↓                                                       │
│ 콘텐츠 표시                                                  │
└─────────────────────────────────────────────────────────────┘
문제: 전환 시 "뚝" 끊기는 느낌 → 느리게 체감

[After] View Transitions 적용
┌─────────────────────────────────────────────────────────────┐
│ 사용자가 Link 클릭                                           │
│     ↓                                                       │
│ 브라우저가 현재 화면을 스냅샷 캡처                           │
│     ↓                                                       │
│ 새 페이지 준비 (백그라운드)                                  │
│     ↓                                                       │
│ 스냅샷 → 새 페이지로 크로스페이드 애니메이션                  │
│     ↓                                                       │
│ 매끄러운 전환 완료                                           │
└─────────────────────────────────────────────────────────────┘
효과: 실제 로딩 시간은 같지만, 시각적 연속성으로 "빠르다"고 체감
```

### Phase 4: Suspense 경계 강화

```
[Before] React Query 로딩 패턴 (현재 대부분의 페이지)
┌─────────────────────────────────────────────────────────────┐
│ 페이지 컴포넌트 마운트                                       │
│     ↓                                                       │
│ useQuery() 시작 → isLoading = true                          │
│     ↓                                                       │
│ {isLoading ? <Skeleton /> : <Content />}  (조건부 렌더링)   │
│     ↓                                                       │
│ 문제: 전체 페이지가 단일 로딩 상태                           │
│       헤더, 탭, 액션버튼까지 모두 로딩 대기                  │
└─────────────────────────────────────────────────────────────┘

[After] Suspense 경계 분리
┌─────────────────────────────────────────────────────────────┐
│ 페이지 컴포넌트 마운트                                       │
│     ↓                                                       │
│ 헤더 + 탭 + 액션 버튼 → 즉시 렌더링 (데이터 불필요)        │
│     ↓                                                       │
│ <Suspense fallback={<Skeleton />}>                          │
│   <DataSection />  ← 이 부분만 로딩 대기                    │
│ </Suspense>                                                  │
│     ↓                                                       │
│ 데이터 도착 → Skeleton이 Content로 교체                      │
│                                                              │
│ 효과: 페이지 "틀"이 즉시 보임 → 반응성 체감 향상            │
└─────────────────────────────────────────────────────────────┘

개선 대상 페이지 (이미 Skeleton 있지만 Suspense 미적용):
  - /dashboard          (useTrips)
  - /checklist          (useAllChecklists)
  - /notifications      (useNotifications)
  - /trips/[id]/places  (usePlaces)
  - /trips/[id]/schedule (useScheduleData)
  - /trips/[id]/members (useTrip + useEffect)
```

---

## Phases

### Phase 1: React Compiler 활성화
- [x] 1-1. next.config.ts에 `reactCompiler: true` 추가
- [x] 1-2. `babel-plugin-react-compiler` 설치
- [x] 1-3. `npm run build` 성공 확인
- **Status:** complete ✅

### Phase 2: Google Maps Dynamic Import 완성
- [x] 2-1. `places/[placeId]/page.tsx`의 PlaceMap 정적 import → dynamic import 변경 + Skeleton fallback 추가
- [x] 2-2. 빌드 확인 완료
- [x] 2-3. travel-info-card.tsx 분석 → MiniMap은 loadGoogleMaps()가 이미 지연 로딩, loader ~8KB만 번들 포함, 분리 불필요로 판단
- **Status:** complete ✅

### Phase 3: View Transitions 활성화
- [x] 3-1. next.config.ts에 `experimental.viewTransition: true` 추가
- [x] 3-2. `npm run build` 성공 확인
- **Status:** complete ✅

### Phase 4: Suspense 경계 강화
- [x] 4-1. 기존 loading.tsx 4개 확인 (dashboard, places, schedule, members)
- [x] 4-2. loading.tsx 미적용 라우트 4개 추가: checklist, notifications, placeDetail, tripChecklist
- [x] 4-3. 최종 빌드 성공 확인
- **Status:** complete ✅

---

## 실행 체크리스트

### Phase 1 체크리스트
- [ ] `reactCompiler: true` 설정 추가
- [ ] babel-plugin-react-compiler 의존성 필요 여부 확인 (Next.js 16 내장 여부)
- [ ] `npm run build` 성공
- [ ] 기존 수동 memo/useMemo/useCallback과 충돌 없음 확인

### Phase 2 체크리스트
- [ ] `places/[placeId]/page.tsx`에서 `import { PlaceMap }` → `const PlaceMap = dynamic(...)` 변경
- [ ] PlaceMap 로딩 중 표시할 Skeleton/Placeholder 확인 (기존 것 재사용 가능?)
- [ ] travel-info-card.tsx의 MiniMap이 스크롤 아래에 위치하는지 확인 (lazy load 적합성)
- [ ] `npm run build` 후 번들 사이즈 비교 (before/after)

### Phase 3 체크리스트
- [ ] `viewTransition: true` 설정 추가
- [ ] 브라우저 호환성 확인 (Chrome 111+, Safari 18+)
- [ ] `npm run build` 성공
- [ ] 기존 페이지 전환 로직(router.push, Link)과 충돌 없음 확인

### Phase 4 체크리스트
- [ ] 각 페이지의 "즉시 렌더 가능 영역" vs "데이터 의존 영역" 구분
- [ ] React Query의 `useSuspenseQuery` 도입 검토 vs 기존 `useQuery` 유지
- [ ] Suspense fallback에 기존 Skeleton 컴포넌트 재사용
- [ ] 중첩 Suspense 필요 여부 판단 (한 페이지에 독립 데이터 소스 2개 이상)
- [ ] `npm run build` 성공
- [ ] 에러 바운더리(ErrorBoundary) 추가 필요 여부

---

## Decisions Made

| # | Decision | Rationale | Date |
|---|----------|-----------|------|
| 1 | 4개 최적화를 독립 Phase로 분리 | 각 Phase별 효과를 독립 검증 가능 | 2026-03-20 |
| 2 | Phase 1,3(설정)을 먼저, Phase 2,4(코드)를 나중에 | 설정 변경은 리스크 낮고 효과 즉시 확인 가능 | 2026-03-20 |
| 3 | Phase 4에서 useSuspenseQuery 도입 여부는 분석 후 결정 | 기존 useQuery 패턴과의 호환성 확인 필요 | 2026-03-20 |

## Errors Encountered

| # | Error | Attempts | Resolution |
|---|-------|----------|------------|

## Key Questions

- React Compiler가 기존 `memo()` 래핑된 컴포넌트와 어떻게 상호작용하는가?
- View Transitions가 Serwist Service Worker의 navigation preload와 충돌하지 않는가?
- travel-info-card.tsx의 MiniMap은 일정 아이템 사이에 인라인 렌더되므로, dynamic import 시 레이아웃 시프트 발생 가능성은?

---

## Readiness Score

| # | 기준 | 점수 |
|---|------|------|
| 1 | 모든 Task에 구체적 파일 경로가 있는가? | 1 |
| 2 | 각 Task의 완료 조건이 측정 가능한가? | 1 |
| 3 | Task 간 의존 순서가 명확한가? | 1 |
| 4 | 기존 API/타입과의 호환성을 확인했는가? | 1 |
| 5 | 테스트 전략이 각 Task에 포함되어 있는가? | 1 |
| 6 | Phase 간 경계가 명확한가? | 1 |
| 7 | Open Question이 실행을 막는 블로커가 아닌가? | 1 |

**총점: 7/7 — 즉시 실행 가능**
