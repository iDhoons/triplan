# Progress Log

## Session: 2026-03-13

### Completed
- 코드베이스 탐색 완료 (schedule 관련 파일 18개 식별)
- 규모 판단: [L] Large (변경 파일 ~18개)
- 3-File Pattern 계획 수립 완료

### Session: 2026-03-13 (구현)

### Completed
- **Phase 1**: DB 스키마 + 타입 준비
  - `schedule_items` 테이블에 5개 컬럼 추가 (arrival_by, travel_duration_seconds, travel_distance_meters, travel_mode, notify_before_minutes)
  - Supabase 마이그레이션 적용 완료
  - `src/types/database.ts` ScheduleItem 인터페이스 + TravelMode 타입 추가
- **Phase 2**: 순서 기반 UI 전환
  - ViewMode를 "planner" | "route" 2개로 변경 (timeline 제거)
  - `calendar-view.tsx` → `planner-view.tsx` 리네임 + 순서 번호 배지 강조
  - `draggable-item.tsx` — 시간 표시 제거, 순서 번호 + arrival_by 표시
  - `schedule-item-form.tsx` — start_time/end_time → arrival_by + travel_mode
  - `timeline-view.tsx` 삭제
  - `calendar-view.tsx` 삭제
- **Phase 3**: Directions API + 이동 정보
  - `/api/directions/route.ts` 생성 (Google Directions API 래퍼)
  - `travel-info-card.tsx` 컴포넌트 생성 (이동수단 아이콘 + 시간 + 거리)
  - planner-view에 TravelInfoCard 통합
  - 장소 추가/순서 변경 시 이동 정보 자동 계산 + DB 캐싱

### Test Results
| Test | Result | Notes |
|------|--------|-------|
| npm run build | PASS | 타입 에러 0, 컴파일 성공 |

### Files Modified
- `supabase/migrations/20260313_schedule_planner_columns.sql` (신규)
- `src/types/database.ts` (수정 — TravelMode, ScheduleItem 필드 추가)
- `src/app/(main)/trips/[tripId]/schedule/page.tsx` (전면 리라이트)
- `src/components/schedule/planner-view.tsx` (신규 — calendar-view 대체)
- `src/components/schedule/draggable-item.tsx` (전면 리라이트)
- `src/components/schedule/schedule-item-form.tsx` (전면 리라이트)
- `src/components/schedule/travel-info-card.tsx` (신규)
- `src/app/api/directions/route.ts` (신규)
- `src/components/schedule/timeline-view.tsx` (삭제)
- `src/components/schedule/calendar-view.tsx` (삭제)

### Pending (Phase 4-5)
- Push Notification 인프라 (VAPID, SW push listener, 구독 관리)
- 포그라운드 GPS 보강 (useGeolocation, departure-alert)
