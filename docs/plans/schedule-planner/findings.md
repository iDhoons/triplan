# Findings

## Requirements

- 일정 탭에서 시간 개념 제거, 날짜별 장소 순서만 관리
- 장소 사이에 실제 이동 시간/거리/경로 정보 표시 (Google Directions API)
- 도착 희망 시간(arrival_by) 설정 시 이동시간 역산하여 출발 알림 (Push)
- 앱이 열려있을 때(포그라운드) GPS로 실시간 이동시간 보강

## Research

### 현재 일정 시스템 분석 (2026-03-13)

- **뷰 모드 3개**: calendar (DnD 지원), timeline (시간축), route (지도)
- **schedule_items 필드**: start_time, end_time (TIME nullable), sort_order, transport_to_next (텍스트)
- **DnD**: @dnd-kit/core + @dnd-kit/sortable 사용, 사이드바→일정 드래그 + 일정 내 재정렬
- **이동 수단**: transport_to_next에 텍스트만 저장 ("도보", "버스" 등), 시간/거리 계산 없음
- **좌표**: places 테이블에 latitude/longitude 있음 (nullable)
- **지도**: Google Maps JS API 로드 중이나, Directions API는 미사용
- **거리 계산**: Haversine 직선거리만 (route-map.tsx)

### PWA/Notification 현황 (2026-03-13)

- **Service Worker**: Serwist 기반, 캐싱 전략 5개 설정됨
- **Push Notification**: 인프라 전무 — push listener, VAPID, 구독 관리 모두 없음
- **Geolocation**: Permissions-Policy에서 self 허용 설정만, 실제 사용 코드 없음
- **manifest.ts**: share_target만 설정, notification 관련 없음

### 의존성 확인 (2026-03-13)

- `@dnd-kit/core`, `@dnd-kit/sortable` — 드래그앤드롭
- `serwist`, `@serwist/next` — Service Worker
- `@googlemaps/js-api-loader` — Google Maps
- `web-push` — **미설치** (Phase 4에서 설치 필요)

## Technical Decisions

| Decision | Options Considered | Choice | Reason |
|----------|--------------------|--------|--------|
| 이동 정보 계산 | Haversine 추정 vs Google Directions API | Directions API | 실제 도보/대중교통 경로 필요, 정확도 중요 |
| 알림 발송 | Firebase FCM vs Web Push (VAPID) | Web Push (VAPID) | 별도 Firebase 의존성 불필요, PWA 네이티브 |
| 알림 스케줄링 | Client setTimeout vs Server cron | Server (pg_cron / Edge Function) | 백그라운드 동작, 앱 닫혀도 작동 |
| 이동 정보 캐싱 | 별도 테이블 vs schedule_items 필드 | schedule_items 필드 | 조인 불필요, 항목과 1:1 관계 |

## Issues

- Google Directions API 활성화 여부 미확인 (Google Cloud Console에서 확인 필요)
- Supabase Free tier에서 pg_cron 사용 가능 여부 확인 필요 (Pro 이상일 수 있음)
- web-push npm 패키지 설치 필요
