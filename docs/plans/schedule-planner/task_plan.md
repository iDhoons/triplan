# Schedule Planner — 순서 기반 데일리 플래너 + 이동 정보 + 출발 알림

**Goal:** 일정 탭을 시간 기반에서 순서 기반 데일리 플래너로 전환하고, 장소 간 실제 이동 정보(시간/거리/수단)를 표시하며, 시간 기반 Push 알림 + 포그라운드 GPS 보강으로 출발 시점을 안내한다.

**Architecture:**
- 일정 UI를 2개 모드(플래너/동선)로 단순화하고, 시간 대신 순서 + 희망 도착 시간(optional)으로 전환
- Google Directions API로 장소 간 실제 이동 시간/거리 계산, 결과를 DB에 캐싱
- Web Push API(VAPID) + Service Worker로 시간 기반 출발 알림, 포그라운드에서는 Geolocation으로 실시간 이동시간 보강

**Tech Stack:** Next.js 16, Supabase (DB + Edge Functions), Google Directions API, Web Push API, Geolocation API, Serwist

**Created:** 2026-03-13

---

## Current Phase

Phase 4: Push Notification 인프라 — Status: pending (Phase 1-3 완료)

## Phases

### Phase 1: DB 스키마 + 타입 준비

- [x] 1-1. `schedule_items` 테이블에 컬럼 추가 (Supabase migration) ✅ 2026-03-13
  - `arrival_by` TIMESTAMPTZ nullable — 희망 도착 시간
  - `travel_duration_seconds` INTEGER nullable — 이전 장소에서 이동 시간 (초)
  - `travel_distance_meters` INTEGER nullable — 이전 장소에서 이동 거리 (미터)
  - `travel_mode` TEXT nullable — 이동 수단 (walking/transit/driving)
  - `notify_before_minutes` INTEGER DEFAULT 5 — 출발 몇 분 전 알림
- [ ] 1-2. `notification_subscriptions` 테이블 생성 (Phase 4에서 처리)
  - `id` UUID PK
  - `user_id` UUID FK → profiles
  - `endpoint` TEXT NOT NULL — Push subscription endpoint
  - `p256dh` TEXT NOT NULL — Public key
  - `auth` TEXT NOT NULL — Auth secret
  - `created_at` TIMESTAMPTZ
- [x] 1-3. `src/types/database.ts` ScheduleItem 인터페이스에 새 필드 추가 ✅ 2026-03-13
- **Status:** done ✅

### Phase 2: 순서 기반 UI 전환

- [x] 2-1. `page.tsx` — ViewMode를 "planner" | "route" 2개로 변경, timeline 제거 ✅
- [x] 2-2. `calendar-view.tsx` → `planner-view.tsx` 로 리네임 + 리디자인 ✅
  - 시간 대신 순서 번호(원형 배지) 강조
  - TransportBadge를 TravelInfoCard로 교체
  - 기존 DnD 유지
- [x] 2-3. `draggable-item.tsx` — 시간(Clock) 표시 제거, 순서 번호 + arrival_by 표시 ✅
- [x] 2-4. `schedule-item-form.tsx` — start_time/end_time → arrival_by (단일 시간) + 이동수단(travel_mode) 변경 ✅
- [x] 2-5. `timeline-view.tsx` 파일 삭제 + calendar-view.tsx 삭제 + import 정리 ✅
- **Status:** done ✅

### Phase 3: Directions API + 이동 정보

- [x] 3-1. `/api/directions/route.ts` 생성 — Google Directions API 호출 ✅
  - Input: origin(lat,lng), destination(lat,lng), mode(walking/transit/driving)
  - Output: duration_seconds, distance_meters, summary
  - 인증 확인
- [x] 3-2. `travel-info-card.tsx` 컴포넌트 생성 ✅
  - 이동 수단 아이콘 + 시간 + 거리 표시
  - "도보 15분 · 1.2km" 형태
  - 로딩/미계산/캐싱됨 3가지 상태
- [x] 3-3. planner-view에 TravelInfoCard 통합 ✅
  - 장소 간 자동 계산 (양쪽 모두 좌표가 있을 때)
  - 순서 변경/장소 추가 시 이동 정보 재계산
  - 결과를 schedule_items의 travel_* 필드에 저장 (캐싱)
- **Status:** done ✅

### Phase 4: Push Notification 인프라

- [ ] 4-1. VAPID 키 생성 + 환경변수 추가
  - `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`
- [ ] 4-2. `sw.ts`에 push event listener 추가
  - notification 표시 (제목, 본문, 아이콘, 클릭 시 해당 일정 페이지로 이동)
- [ ] 4-3. `useNotifications` hook 생성 (`src/hooks/use-notifications.ts`)
  - 알림 권한 요청 (Notification.requestPermission)
  - Push subscription 생성 (PushManager.subscribe)
  - 구독 정보 서버 전송
- [ ] 4-4. `/api/notifications/subscribe/route.ts` — 구독 저장/삭제 API
- [ ] 4-5. `/api/notifications/send/route.ts` — 특정 사용자에게 push 발송
  - web-push 라이브러리 사용
  - Input: user_id, title, body, url
- [ ] 4-6. 알림 스케줄링 로직
  - arrival_by 설정 시 → 출발 시간 계산 (arrival_by - travel_duration - notify_before)
  - Supabase pg_cron 또는 Edge Function cron으로 매분 체크 → push 발송
- **Status:** pending

### Phase 5: 포그라운드 GPS 보강

- [ ] 5-1. `useGeolocation` hook 생성 (`src/hooks/use-geolocation.ts`)
  - watchPosition으로 현재 위치 추적
  - 정확도/에러 처리
  - 포그라운드에서만 동작 (visibility API 연동)
- [ ] 5-2. `departure-alert.tsx` 컴포넌트 생성
  - 현재 위치 → 다음 목적지 실시간 이동시간 계산 (Directions API)
  - "지금 출발하면 15:50 도착 (10분 여유)" 표시
  - 이동시간이 남은시간에 근접하면 화면 내 알림
- [ ] 5-3. schedule page에 통합
  - arrival_by가 설정된 다음 일정이 있을 때 자동 활성화
  - 하단 플로팅 바 또는 상단 배너 형태
- **Status:** pending

### Phase 6: 통합 검증 + 정리

- [ ] 6-1. `npm run build` 성공 확인
- [ ] 6-2. 타입 에러 0개 확인
- [ ] 6-3. 기존 DnD 기능 정상 동작 확인
- [ ] 6-4. 미사용 import/파일 정리
- **Status:** pending

---

## Decisions Made

| # | Decision | Rationale | Date |
|---|----------|-----------|------|
| 1 | timeline 뷰 제거, 2개 모드(planner/route) | 시간 개념을 없애므로 시간축 뷰 불필요 | 2026-03-13 |
| 2 | arrival_by를 TIMESTAMPTZ로 (TIME이 아닌) | 여행 중 날짜+시간이 모두 필요, 시간대 처리 | 2026-03-13 |
| 3 | Google Directions API 사용 (Haversine 대신) | 실제 이동시간/경로 필요, 정확도 중요 | 2026-03-13 |
| 4 | 이동 정보를 DB에 캐싱 (travel_* 필드) | API 호출 비용 절감, 오프라인 대비 | 2026-03-13 |
| 5 | Supabase Edge Function cron 대신 pg_cron 우선 검토 | 인프라 단순화, 이미 Supabase 사용 중 | 2026-03-13 |

## Errors Encountered

| # | Error | Attempts | Resolution |
|---|-------|----------|------------|

## Key Questions

- Google Directions API 키: 기존 `GOOGLE_PLACES_API_KEY`에 Directions API가 활성화되어 있는지 확인 필요
- pg_cron 활성화 여부: Supabase 프로젝트에서 pg_cron extension이 사용 가능한지 확인
- VAPID 키 저장 위치: .env.local + Supabase Edge Function secrets
