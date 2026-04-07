# Collaboration Features Implementation Plan

**Goal:** 카카오/범용 공유, 알림 시스템, 게스트 모드, 활동 대시보드 4개 기능을 구현하여 협업 경험을 완성한다.
**Architecture:** Supabase DB Triggers → activity_logs 자동 기록 → notifications 테이블 자동 생성 → Realtime 구독 + Web Push 발송. 기존 Realtime/PWA 인프라를 최대한 활용.
**Tech Stack:** Next.js 16 + Supabase (PostgreSQL Triggers, Realtime, Edge Functions) + Serwist (Web Push) + Web Share API
**Created:** 2026-03-19
**Scale:** XL (5 Epics, ~30 files)

---

## Current Phase

Phase 0: Activity Logging Foundation — Status: pending

---

## Execution Order & Dependencies

```
Epic 0: Activity Logging Foundation (공통 기반)
  ↓ (Epic 1, 4가 의존)
Epic 1: Activity Dashboard ← activity_logs 데이터 필요
Epic 2: Web Share + Dynamic OG ← 독립적
Epic 3: Guest Mode ← 독립적
Epic 4: Notification System ← activity_logs + 가장 큰 작업
```

**병렬 가능:** Epic 2, 3은 독립적이므로 Epic 1 완료 후 병렬 진행 가능

---

## Phases

### Phase 0: Activity Logging Foundation
> activity_logs에 모든 사용자 활동을 자동 기록하는 DB 트리거 구축

- [ ] 🤖 0-1. Supabase migration: `fn_log_activity()` SECURITY DEFINER 함수 작성
  - places: INSERT → place_added, UPDATE → place_updated, DELETE → place_removed
  - schedule_items: INSERT → schedule_item_added, DELETE → schedule_item_removed
  - checklist_items: INSERT → checklist_item_added, UPDATE(is_checked) → checklist_checked/unchecked
  - place_votes: INSERT → vote_added
  - trip_members: INSERT → member_joined
- [ ] 🤖 0-2. 각 테이블에 AFTER trigger 연결 (5개 테이블)
- [ ] 🤖 0-3. trip_id 자동 해석 로직 (schedule_items → schedules → trip_id 조인)
- [ ] 🤖 0-4. metadata에 target 이름 포함 (places.name, checklist_items.title 등)
- [ ] 🤖 0-5. 검증: 장소 추가/삭제/투표 시 activity_logs 자동 기록 확인
- [ ] 🤖 0-6. 기존 activity-toast.tsx 동작 정상 확인 (Realtime → Toast)
- **Status:** pending
- **Files:**
  - Create: `supabase/migrations/YYYYMMDD_activity_log_triggers.sql`
  - Verify: `src/components/realtime/activity-toast.tsx`

### Phase 1: Activity Dashboard
> 멤버 페이지에 기여도 요약 + 활동 타임라인 + 체크리스트 현황 추가

- [ ] 1-1. API: `GET /api/trips/[tripId]/stats` — 멤버별 기여도 집계
  - places 추가 수, votes 수, checklist 완료 수 (activity_logs 기반)
- [ ] 1-2. API: `GET /api/trips/[tripId]/activity` — 최근 활동 타임라인
  - activity_logs + profiles 조인, 커서 페이지네이션, 최신순
- [ ] 1-3. API: `GET /api/trips/[tripId]/checklist-stats` — 체크리스트 할당 현황
  - checklist_items에서 assigned_to별 완료/미완료 수
- [ ] 1-4. 컴포넌트: `MemberContribution` — 멤버별 기여도 바 차트
- [ ] 1-5. 컴포넌트: `ActivityTimeline` — 시간순 활동 내역 (아바타 + 액션 + 시간)
- [ ] 1-6. 컴포넌트: `ChecklistProgress` — 멤버별 체크리스트 진행률 바
- [ ] 1-7. members/page.tsx에 3개 컴포넌트 통합 (탭 또는 섹션)
- [ ] 1-8. React Query 훅: `useTripStats`, `useTripActivity`, `useChecklistStats`
- [ ] 1-9. 빈 상태 처리 (아직 활동 없을 때)
- [ ] 1-10. 빌드 검증
- **Status:** pending
- **Files:**
  - Create: `src/app/api/trips/[tripId]/stats/route.ts`
  - Create: `src/app/api/trips/[tripId]/activity/route.ts`
  - Create: `src/app/api/trips/[tripId]/checklist-stats/route.ts`
  - Create: `src/components/members/member-contribution.tsx`
  - Create: `src/components/members/activity-timeline.tsx`
  - Create: `src/components/members/checklist-progress.tsx`
  - Modify: `src/app/(main)/trips/[tripId]/members/page.tsx`
  - Create: `src/hooks/use-trip-stats.ts`

### Phase 2: Web Share + Dynamic OG
> Web Share API로 범용 공유 + 초대 링크 동적 미리보기

- [ ] 2-1. members/page.tsx: "공유" 버튼 추가
  - navigator.share() 지원 시 → Web Share API
  - 미지원 시 → clipboard.writeText() fallback
- [ ] 2-2. 공유 데이터 구성: title="[여행명] 초대", text="[목적지] [날짜]에 함께 가요!", url="/join/[code]"
- [ ] 2-3. /join/[inviteCode]/page.tsx → layout.tsx에 generateMetadata 추가
  - 서버에서 invite_code로 trip 조회 → 동적 title, description, OG tags
- [ ] 2-4. OG 이미지: 텍스트 기반 자동 생성 (Next.js ImageResponse) 또는 기본 이미지
- [ ] 2-5. 기존 "초대 링크 복사" 버튼과 "공유" 버튼 UI 정리
- [ ] 2-6. 검증: 카카오톡/라인 등에서 링크 미리보기 확인
- **Status:** pending
- **Files:**
  - Modify: `src/app/(main)/trips/[tripId]/members/page.tsx`
  - Create: `src/app/join/[inviteCode]/layout.tsx` (generateMetadata)
  - Create: `src/app/api/og/route.tsx` (OG 이미지 생성, optional)

### Phase 3: Guest Mode
> 초대 링크로 비로그인 사용자가 장소+일정 열람 가능

- [ ] 3-1. /join/[inviteCode]/page.tsx 리팩토링: 비로그인 상태 분기 추가
  - 로그인 O + 멤버 → redirect
  - 로그인 O + 비멤버 → "참가하기" 버튼 (현재와 동일)
  - 로그인 X → 게스트 읽기 전용 뷰 + "가입하고 참여하기" CTA
- [ ] 3-2. 게스트 뷰 컴포넌트: `GuestTripPreview`
  - 장소 목록 (이름, 카테고리, 사진) — 읽기 전용
  - 일정 요약 (Day별 장소 목록) — 읽기 전용
  - 블러 처리 또는 일부만 표시 (가입 유도)
- [ ] 3-3. 서버 데이터 조회: invite_code → trip_id → places + schedule_items
  - Supabase service role로 조회 (게스트는 인증 없으므로)
  - API Route: `GET /api/guest/[inviteCode]` — 제한된 데이터만 반환
- [ ] 3-4. 보안: 게스트 API에서 민감 데이터 제외 (체크리스트, 투표 수, 멤버 상세)
- [ ] 3-5. CTA: "가입하고 참여하기" → /signup?next=/join/[code]
- [ ] 3-6. 가입 완료 후 /join/[code]로 돌아오면 "참가하기" 버튼 표시
- [ ] 3-7. middleware.ts 확인: /join/ 경로는 이미 공개 (변경 불필요)
- [ ] 3-8. 빌드 검증
- **Status:** pending
- **Files:**
  - Modify: `src/app/join/[inviteCode]/page.tsx`
  - Create: `src/components/guest/guest-trip-preview.tsx`
  - Create: `src/app/api/guest/[inviteCode]/route.ts`

### Phase 4: Notification System
> 앱 내 알림 목록 + 배지 + PWA 푸시 알림

#### Phase 4A: DB + 앱 내 알림 (필수)
- [ ] 4A-1. Migration: `notifications` 테이블 생성 + RLS + 인덱스
- [ ] 4A-2. Migration: `fn_create_notifications_from_activity()` — activity_logs INSERT 트리거
  - 같은 trip의 모든 멤버에게 알림 생성 (자신 제외)
  - actor_name 비정규화 (스냅샷)
- [ ] 4A-3. TypeScript 타입 추가: `Notification`, `NotificationType`
- [ ] 4A-4. API: `GET /api/notifications` — 알림 목록 (커서 페이지네이션)
- [ ] 4A-5. API: `GET /api/notifications/count` — 안읽은 배지 카운트
- [ ] 4A-6. API: `PATCH /api/notifications/[id]/read` — 단건 읽음
- [ ] 4A-7. API: `PATCH /api/notifications/read-all` — 전체 읽음
- [ ] 4A-8. Hook: `useNotifications` — 알림 목록 + 실시간 갱신
- [ ] 4A-9. Hook: `useNotificationCount` — 배지 카운트 + Realtime 구독
- [ ] 4A-10. /notifications 페이지 구현 (플레이스홀더 교체)
  - 알림 카드 리스트 (아이콘 + 제목 + 시간 + 읽음 상태)
  - 클릭 → 해당 여행/장소로 딥링크
  - "모두 읽음" 버튼
  - 무한 스크롤 (커서 페이지네이션)
- [ ] 4A-11. BottomNav + Sidebar에 배지 카운트 표시
- [ ] 4A-12. 빌드 검증

#### Phase 4B: PWA 푸시 알림 (확장)
- [ ] 4B-1. VAPID 키 생성 + 환경변수 설정
- [ ] 4B-2. Migration: `push_subscriptions` 테이블 생성 + RLS
- [ ] 4B-3. API: `POST /api/notifications/push/subscribe` — 구독 등록
- [ ] 4B-4. API: `DELETE /api/notifications/push/subscribe` — 구독 해제
- [ ] 4B-5. Service Worker: push 이벤트 핸들러 추가 (sw.ts)
- [ ] 4B-6. 알림 권한 요청 UI (프로필 설정 또는 최초 진입 시)
- [ ] 4B-7. Edge Function 또는 API Route: 푸시 발송 로직
  - notifications INSERT → push_subscriptions 조회 → web-push 발송
- [ ] 4B-8. 푸시 클릭 → 앱 열기 + 딥링크
- [ ] 4B-9. 만료 구독 정리 (410 응답 시 is_active=false)
- [ ] 4B-10. 빌드 검증

- **Status:** pending
- **Files:**
  - Create: `supabase/migrations/YYYYMMDD_notifications_table.sql`
  - Create: `supabase/migrations/YYYYMMDD_push_subscriptions_table.sql`
  - Create: `src/app/api/notifications/route.ts`
  - Create: `src/app/api/notifications/count/route.ts`
  - Create: `src/app/api/notifications/[id]/read/route.ts`
  - Create: `src/app/api/notifications/read-all/route.ts`
  - Create: `src/app/api/notifications/push/subscribe/route.ts`
  - Create: `src/hooks/use-notifications.ts`
  - Create: `src/hooks/use-notification-count.ts`
  - Modify: `src/app/(main)/notifications/page.tsx`
  - Create: `src/components/notifications/notification-card.tsx`
  - Create: `src/components/notifications/notification-list.tsx`
  - Modify: `src/components/layout/bottom-nav.tsx` (배지)
  - Modify: `src/components/layout/sidebar.tsx` (배지)
  - Modify: `src/app/sw.ts` (push handler)
  - Modify: `src/types/database.ts`

---

## Data Flow Diagrams

### Activity Logging (Phase 0)
```
User action (e.g., add place)
  → Supabase client: places.insert()
  → DB Trigger: fn_log_activity()
  → activity_logs INSERT
  → Realtime: postgres_changes
  → ActivityToast (기존) + notifications 트리거 (Phase 4)
```

### Notification System (Phase 4)
```
activity_logs INSERT
  → DB Trigger: fn_create_notifications_from_activity()
  → notifications INSERT (trip members except actor)
  → Realtime: user별 채널 구독
  → Client: 배지 카운트 갱신 + 알림 목록 갱신

  (Phase 4B 추가)
  → Edge Function: notify-push
  → push_subscriptions 조회
  → Web Push API 발송
  → Service Worker: push event → system notification
```

### Guest Mode (Phase 3)
```
/join/[inviteCode]
  → Check auth status
  ├─ Logged in + member → redirect to /trips/[id]/places
  ├─ Logged in + not member → "참가하기" button
  └─ Not logged in → Guest preview (read-only)
       → GET /api/guest/[inviteCode] (service role)
       → Show places + schedule summary
       → CTA: "가입하고 참여하기" → /signup?next=/join/[code]
```

### Web Share (Phase 2)
```
Members page → "공유" button
  → navigator.share() supported?
  ├─ Yes → OS share sheet (카카오/라인/문자 등)
  └─ No → clipboard.writeText() + toast "링크 복사됨"

/join/[inviteCode] opened by recipient
  → generateMetadata() → OG tags (title, description, image)
  → Social app renders preview card
```

---

## Decisions Made

| # | Decision | Rationale | Date |
|---|----------|-----------|------|
| 1 | DB Triggers for activity logging | 일관성 보장, 누락 방지, 중앙화 관리 | 2026-03-19 |
| 2 | notifications 테이블 분리 (activity_logs 재사용 X) | 멤버별 읽음 상태, 1:N 관계 필요 | 2026-03-19 |
| 3 | SECURITY DEFINER 함수 사용 | RLS 우회하여 모든 사용자 활동 기록 | 2026-03-19 |
| 4 | Phase 4를 4A/4B로 분리 | 인앱 알림만으로도 가치 있음, 푸시는 확장 | 2026-03-19 |
| 5 | Web Share API 선택 (카카오 SDK X) | 범용성, SDK 의존 없음 | 2026-03-19 |
| 6 | 게스트 API는 service role 조회 | 비인증 사용자 → RLS 우회 필요 | 2026-03-19 |

## Errors Encountered

| # | Error | Attempts | Resolution |
|---|-------|----------|------------|
| - | - | - | - |

## Key Questions

- Web Push용 VAPID 키는 Supabase 환경변수에 저장할지, Vercel 환경변수에 저장할지?
- OG 이미지를 Next.js ImageResponse로 동적 생성할지, 기본 이미지 1장으로 갈지?
- 알림 보존 기간 (30일 자동 삭제 등) 정할지?
