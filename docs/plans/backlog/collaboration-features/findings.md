# Findings

## Requirements
- 카카오/범용 공유: Web Share API + 동적 OG 메타태그 (여행별 제목/날짜/목적지)
- 알림 시스템: 전체 활동 알림 + 앱 내 알림 페이지 + PWA 푸시 알림
- 게스트 모드: 초대 링크 비로그인 열람 (장소+일정) + 가입 후 참가 버튼 전환
- 활동 대시보드: 멤버 페이지에 기여도 요약 + 활동 타임라인 + 체크리스트 현황

## Research

### 1. activity_logs 현재 상태 (Critical Finding)
- **기록되는 액션**: youtube_analyze만 (1종)
- **포맷만 정의된 액션**: place_added, place_removed, place_updated, vote_added, schedule_updated, schedule_item_added, schedule_item_removed, member_joined (8종)
- **원인**: application-level INSERT가 YouTube API route에만 있고, 나머지는 미구현
- **영향**: 대시보드와 알림 모두 이 데이터에 의존 → Phase 0 선행 필수

### 2. Realtime 구독 구조
- 채널: `trip:{tripId}` 단일 채널
- activity_logs INSERT → CustomEvent "activity" → ActivityToast
- DB trigger로 activity_logs 자동 기록하면 기존 Realtime 파이프라인 그대로 동작

### 3. PWA 인프라
- Serwist v9.5.6 사용 중, Service Worker 정상 동작
- push 이벤트 핸들러 없음 → 추가 필요
- manifest.json에 share_target 이미 설정됨
- sw-register.tsx에서 production에서만 등록

### 4. /notifications 페이지
- 라우트 존재: `/app/(main)/notifications/page.tsx`
- 현재 "준비 중입니다" 플레이스홀더만
- BottomNav에서 Bell 아이콘으로 접근 가능 (navigation.ts)

### 5. middleware 공개 경로
- `/join/` 접두사는 이미 공개 → 게스트 모드에 추가 변경 불필요
- 단, 현재 join page에서 미인증 시 login으로 리다이렉트하는 로직이 **page 레벨**에 있음 → 이 부분만 수정

### 6. OG 메타태그
- 현재 root layout에 기본 metadata만 있음 (title, description)
- /join/[inviteCode] 경로에 별도 metadata 없음
- Next.js generateMetadata로 서버사이드 동적 생성 가능

### 7. 멤버 페이지 구조
- 초대 링크 관리 (상단) + 멤버 리스트 (하단)
- 대시보드 추가 시 멤버 리스트 아래 또는 탭으로 분리 가능
- 현재 클라이언트 직접 Supabase 쿼리 (API Route 미사용)

## Technical Decisions

| Decision | Options Considered | Choice | Reason |
|----------|--------------------|--------|--------|
| Activity logging 방식 | A. DB Triggers / B. Application-level | A. DB Triggers | 일관성 보장, 누락 방지, SECURITY DEFINER로 RLS 우회 |
| Notifications 저장소 | A. activity_logs 재사용 / B. 별도 테이블 | B. 별도 notifications 테이블 | 멤버별 읽음 상태 필요 (1 activity → N notifications) |
| 공유 방식 | A. 카카오 SDK / B. Web Share API | B. Web Share API | 범용성, SDK 의존 없음, 카카오 외 앱도 지원 |
| 게스트 데이터 조회 | A. RLS 허용 / B. Service role | B. Service role API | 비인증 사용자 → RLS 적용 불가, 제한된 필드만 반환 |
| OG 메타태그 | A. 정적 / B. 동적 (generateMetadata) | B. 동적 | 여행별 제목/날짜/목적지 표시 필요 |
| 푸시 발송 위치 | A. API Route / B. Edge Function | B. Edge Function (권장) | 긴 실행 시간, 서버리스 환경 적합 |
| trip_id 해석 (schedule_items) | A. 앱에서 전달 / B. 트리거 내 조인 | B. 트리거 내 JOIN | schedule_items → schedules.trip_id 자동 해석 |

## Issues
- activity_logs의 trip_id가 일부 테이블에서 직접 접근 불가 (schedule_items, checklist_items는 중간 테이블 경유)
  - schedule_items → schedules.trip_id
  - checklist_items는 trip_id 직접 보유 (확인 필요)
- Web Push 발송 시 Supabase Edge Function에서 `web-push` npm 패키지 사용 가능 여부 확인 필요
  - 대안: API Route에서 발송 (Next.js 서버)
- 게스트 모드에서 Supabase service role 키 사용 → 보안 주의 (반환 필드 제한 필수)
