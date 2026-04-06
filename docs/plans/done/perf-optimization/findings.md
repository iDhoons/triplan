# Findings — 사용자 체감 속도 개선

## Requirements
- 4가지 최적화를 순서대로 적용: React Compiler → Maps Dynamic Import → View Transitions → Suspense
- 각 단계별 독립 검증 가능해야 함
- 기존 기능 회귀 없어야 함

## Research

### React Compiler (Phase 1)
- Next.js 16은 React Compiler를 안정 지원 (experimental 아님)
- `next.config.ts`에 `reactCompiler: true` 1줄로 활성화
- 기존 `useMemo`, `useCallback`, `memo`와 공존 가능 (중복되지만 충돌 안 함)
- 효과: 불필요한 리렌더링 자동 제거, 특히 리스트/폼이 많은 페이지에서 체감

### Google Maps Dynamic Import (Phase 2)
- 현재 상태 분석:
  - `places/page.tsx` → ✅ dynamic import 적용됨
  - `schedule/page.tsx` → ✅ dynamic import 적용됨
  - `places/[placeId]/page.tsx` (line 45) → ❌ 정적 import: `import { PlaceMap } from "@/components/maps/place-map"`
  - `travel-info-card.tsx` (line 15) → ⚠️ `loadGoogleMaps` 직접 import, MiniMap 컴포넌트가 인라인 정의
- `@googlemaps/js-api-loader` 자체는 ~8KB로 작지만, `loadGoogleMaps()` 호출 시 SDK 전체(~200KB) 다운로드 트리거
- travel-info-card의 MiniMap은 일정 아이템 사이 카드에 렌더됨 — 카드 확장 시에만 보임 (collapsed가 기본)

### View Transitions (Phase 3)
- Next.js 16에서 `experimental.viewTransition: true`로 활성화
- React 19.2의 `<ViewTransition>` 컴포넌트 기반
- 브라우저 View Transitions API 사용 (Chrome 111+, Safari 18+)
- 미지원 브라우저에서는 graceful degradation (기존 방식으로 동작)

### Suspense 경계 (Phase 4)
- 현재 16개 페이지 중 11개가 Skeleton 있지만, Suspense 경계는 2개만 사용
- 대부분 `{isLoading ? <Skeleton /> : <Content />}` 패턴
- React Query v5는 `useSuspenseQuery` 지원 — Suspense 경계와 자연스럽게 통합
- 주의: `useSuspenseQuery`로 전환 시 에러 처리를 ErrorBoundary로 해야 함

## Technical Decisions

| Decision | Options Considered | Choice | Reason |
|----------|--------------------|--------|--------|
| React Compiler 활성화 방식 | experimental vs stable | stable (`reactCompiler: true`) | Next.js 16에서 안정 지원 |
| Maps Dynamic Import 범위 | placeDetail만 vs travel-info-card도 | placeDetail 우선, travel-info-card는 분석 후 결정 | MiniMap은 collapsed 상태가 기본이라 실제 SDK 로드는 expand 시에만 발생할 수 있음 |
| Suspense 전환 전략 | 전체 useSuspenseQuery 전환 vs 점진적 | 점진적 (효과 큰 2-3 페이지만) | 전면 전환은 에러 처리 패턴 변경 필요, 리스크 큼 |

## Issues
- travel-info-card.tsx의 MiniMap은 컴포넌트 내부에 인라인 정의 → 분리하려면 props 전달 구조 변경 필요
- View Transitions + Service Worker navigation preload 충돌 가능성 → 테스트 필요
