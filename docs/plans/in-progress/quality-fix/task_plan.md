# Triplan Quality Fix — Implementation Plan

**Goal:** 6-Expert Evaluation(B+)에서 발견된 CRITICAL 3 + HIGH 5 + MEDIUM 7 + LOW 8건을 데이터 흐름 순으로 수정하여 **B+ → A-** 달성
**Architecture:** 기존 코드 수정 중심. 데이터 흐름 순서: DB → API → Hooks/Realtime → Components → Config
**Tech Stack:** Next.js 16 + React 19 + TypeScript + Supabase + Tailwind CSS 4
**Created:** 2026-03-25 | **Restructured:** 2026-04-01 (6-Expert Evaluation 기반 재구성)
**Evaluation Report:** `docs/research/research-project-evaluation-2026-04-01.md`

---

## Current Phase

Phase 11: Advanced Optimization — Status: in_progress (11-2 완료, 11-1/3/4 pending)

## Phase History

- Phase 1~4: 2026-03-25 초기 계획 → Phase 6~11로 재구성 (데이터 흐름 순서)
- Phase 5: critic v2.0 발견 → **done** (2026-04-01)

## Phases

### Phase 6: Database Foundation (DB 계층 안정화)
> DB가 모든 계층의 기반. 인덱스/스키마/RLS를 먼저 정비해야 상위 계층이 안정적.

- [x] 6-1. **DB 인덱스 6개 추가** — `20260401_phase6_db_foundation.sql`
- [ ] 🤖 6-2. **Base schema migration 생성** — 수동 작업 필요 (`supabase db dump`)
- [x] 6-3. **Schedule reorder RPC** — `reorder_schedule_items(schedule_id, ordered_ids)`
- [x] 6-4. **activity_logs 불변화** — UPDATE/DELETE RLS 정책 제거
- [x] 6-5. **place_votes UPDATE RLS 추가** — `place_votes_update_own` 정책
- [x] 6-6. **notifications.activity_log_id** — `text` → `uuid` 타입 수정
- [x] 6-7. **Stats API SQL 전환** — `get_contribution_stats` RPC + `Promise.all` 병렬 조회
- **Status:** done (6-2 제외, 수동 작업 필요) — 2026-04-01
- **Severity:** CRITICAL(3) + MEDIUM(3) + LOW(1)

### Phase 7: API Security & Validation (서버 계층 강화)
> API route의 인증, 입력 검증, 에러 처리를 통일. DB 안정화 후 진행.

- [x] 7-1. `weather/route.ts` — 이미 `withTripMember` 사용 중 (변경 불필요)
- [x] 7-2. `places/[id]/enrich/route.ts` — viewer 쓰기 차단 추가 + checkRateLimit 이미 적용
- [x] 7-3. `withTripEditor` 가드 — 이미 guards.ts:127-137에 존재 확인
- [ ] 🤖 7-4. `guards-coverage.test.ts` — 별도 진행
- [x] 7-5. `resolve-photos` — Place ID 형식 검증 추가
- [x] 7-6. `share/receive` — FormData null/타입/길이 검증 추가
- [x] 7-7. `notifications/[id]/read` — URL regex → Next.js route params 전환 (나머지 4곳은 withTripMember 콜백 내 regex로 유지가 적절)
- [x] 7-8. cursor ISO 8601 검증 — `notifications`, `activity` route
- [x] 7-9. 에러 응답 형식 통일 — ai/recommend(5곳) + places/photo(1곳) + scrape(2곳)
- [ ] 👤 7-10. Rate limiter DB 기반 전환 — 별도 진행 (큰 작업)
- [ ] 🤖 7-11. CSP img-src — 별도 진행
- [x] 7-12. Gemini API Key `.trim()` 체크 — recommend + classify + extract-places
- **Status:** 9/12 done (7-4, 7-10, 7-11 별도) — 2026-04-01
- **Severity:** HIGH(5) + MEDIUM(4) + existing(3)

### Phase 8: Hooks & Realtime Sync (상태 동기화 계층)
> Query key, Realtime 구독, 커스텀 훅 정비. API 계층이 안정된 후 진행.

- [x] 8-1. **Query Key Factory 전체 적용** — 15개 파일 (hooks 11 + realtime-provider + progress-banner + checklist/page + youtube-picker)
- [x] 8-2. **Schedule reorder hook** — Promise.all → `supabase.rpc("reorder_schedule_items")` 단일 RPC
- [x] 8-3. **RealtimeProvider user → user?.id** — 의존성 배열 수정
- [x] 8-4. **place_votes Realtime 필터** — place_votes에 trip_id 컬럼 추가 후 필터 적용 (commit 8b2fdc7)
- [x] 8-5. **schedule_items Realtime 필터** — trip_id 기반 필터 적용 (commit 8b2fdc7)
- [x] 8-6. **MembersPage** — useState/useEffect → useTripMembers hook + React Query optimistic
- **Status:** done — 2026-04-07
- **Severity:** HIGH(1) + MEDIUM(2) + existing(3)

### Phase 9: Components & Performance (UI 계층)
> Hooks가 안정된 후 컴포넌트 수정. 사용자 체감 성능에 직접 영향.

- [x] 9-1. **PlaceImage `loading="lazy"`** — `src/components/ui/place-image.tsx` (commit a8f574e)
- [x] 9-2. **Photos resolve 병렬화** — `places/page.tsx` Promise.allSettled + CONCURRENCY=5 청크 (commit a8f574e + 1882978)
- [x] 9-3. Error boundary 추가 — dashboard, checklist, notifications, profile (Phase 3: 3-2)
- [x] 9-4. `@dnd-kit` `optimizePackageImports` 추가 (commit 7c50bbd)
- [x] 9-5. CATEGORY_LABELS 중복 정리 → `src/constants/categories.ts` (commit a8f574e, 1882978에서 config/categories.ts로 통합)
- [x] 9-6. console.log 정리 — PlaceForm 디버그 로그 4건 제거 (commit 7c50bbd)
- [x] 9-7. Image cache ExpirationPlugin — SW 이미지 캐시 `maxEntries: 100` (commit 7c50bbd)
- **Status:** done — 2026-04-01 ~ 2026-04-06 ✅
- **Severity:** MEDIUM(2) + LOW(3) + existing(2)

### Phase 10: Infrastructure & Cleanup (환경/설정)
> 독립적으로 진행 가능한 설정, 의존성, 코드 정리.

- [x] 10-1. ESLint CRITICAL — `compare/page.tsx` key 6건 + 변수 접근 + ref 갱신 (Phase 2: 2-2, commit 7c50bbd)
- [x] 10-2. `pnpm audit fix` — 취약 패키지 수정 (Phase 2: 2-3)
- [x] 10-3. Next.js 16.2.1 → 16.2.2 패치 업그레이드 (commit 7c50bbd)
- [~] 10-4. Pretendard 폰트 — SKIPPED (CDN dynamic subset 이미 최적화, Phase 3: 3-12)
- [x] 10-5. `middleware.ts` → `proxy.ts` 리네임 (Phase 3: 3-3)
- [x] 10-6. PWA 아이콘 생성 — `icon-192x192.png`, `icon-512x512.png` (Phase 3: 3-4)
- [x] 10-7. tripId 추출 중복 제거 — `MemberContext`에 `tripId` 추가 (Phase 3: 3-13)
- [x] 10-8. SupabaseClient 타입 통합 — `guards.ts` export + 3곳 import (Phase 3: 3-15, commit 7c50bbd)
- [ ] 🤖 10-9. 접근성 개선 — ARIA 라벨, nav 랜드마크 (보류)
- **Status:** 8/9 done (10-9 보류) — 2026-04-01

### Phase 11: Advanced Optimization (장기 개선)
> 대규모 리팩토링. 시간 여유가 있을 때 진행.

- [ ] 🤖 11-1. Server Component prefetch — Dashboard, PlaceDetail (HydrationBoundary + prefetchQuery)
- [x] 11-2. 외부 API 1회 재시도 + exponential backoff — fetchWithRetry (commit 83165ab)
- [ ] 👤 11-3. CSP nonce 기반 강화 (`unsafe-inline` 제거 검토)
- [ ] 👤 11-4. RealtimeProvider 분할 — 테이블별 핸들러 모듈화
- **Status:** 1/4 done — 2026-04-07

### Phase 12: Verification
- [x] 12-1. `pnpm build` — 빌드 성공 (2026-04-06)
- [x] 12-2. `npx tsc --noEmit` — 타입 에러 0건 (2026-04-06)
- [x] 12-3. `pnpm lint` — ESLint error 0건 (commit 7c50bbd)
- [x] 12-4. `pnpm audit` — 취약점 0건 (2026-04-06)
- [x] 12-5. 기존 테스트 통과 — 120 tests passed (2026-04-06)
- [ ] 12-6. docs/TASKS.md 업데이트
- **Status:** done (12-6 제외) — 2026-04-06

---

### Phase 5: Critic v2.0 발견 — travel-info-card.tsx (2026-04-01)

> critic v2.0 + cross-verify(3모델) 실전 테스트에서 발견. 파일 1개 수정으로 해결 가능.

- [x] 5-1. **markers 인코딩 불일치 수정** — `travel-info-card.tsx:170~195`
  - 수정: URLSearchParams 제거, 전체 URL을 raw string으로 직접 구성
- [x] 5-2. **polyline 7000 매직넘버 개선** — `travel-info-card.tsx:198~203`
  - 수정: `MAX_URL_LENGTH = 16384` 상수 + `src.length + pathParam.length` 기준 체크
- [x] 5-3. **duration_seconds NaN 방어** — `travel-info-card.tsx:136~139`
  - 수정: `line.duration_seconds` falsy 시 조건부 렌더링 (null 반환)
- [x] 5-4. **지도 이미지 로딩 실패 에러 UI** — `travel-info-card.tsx:207~221`
  - 수정: `useState(mapError)` + `onError` 핸들러 + "지도를 불러올 수 없습니다" 폴백 UI
- **Status:** done (2026-04-01)
- **난이도:** Small (파일 1개, ~30분)

---

## Decisions Made

| # | Decision | Rationale | Date |
|---|----------|-----------|------|
| 1 | XL이 아닌 L로 진행 | 신규 기능이 아닌 품질 개선 — Epic/Story 분해보다 Fix 체크리스트가 적합 | 2026-03-25 |
| 2 | Phase 1을 보안 중심으로 | CRITICAL 이슈 중 viewer 역할 미집행과 권한 누락이 가장 위험 | 2026-03-25 |
| 3 | Phase 5 추가 (critic v2.0 발견) | travel-info-card.tsx 마커 인코딩 + NaN 방어 + 에러 UI. Small 규모라 독립 Phase로 분리 | 2026-04-01 |
| 4 | 6-Expert Evaluation 기반 재구성 | Phase 1~4(all pending)를 데이터 흐름 순으로 Phase 6~12로 재구성. DB→API→Hooks→Components 순서로 안정성 우선 | 2026-04-01 |

## Errors Encountered

| # | Error | Attempts | Resolution |
|---|-------|----------|------------|
| — | — | — | — |

## Key Questions

- Next.js 16.2.1 업그레이드 시 breaking change 있는지 확인 필요
- `schedule_items`에 `trip_id` 직접 컬럼이 없음 — Realtime 필터 방법 조사 필요
- Supabase RLS 정책이 viewer 쓰기를 이미 차단하는지 확인 필요
