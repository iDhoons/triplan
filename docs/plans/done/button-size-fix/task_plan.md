# Button Size System Redesign — iOS-Inspired

**Goal:** 버튼 크기 체계를 iOS HIG 기반으로 재설계하여 모바일 PWA에서 44px 최소 터치 타겟을 충족하고, S급 터치 UX를 달성한다.
**Architecture:** Button 컴포넌트의 size variant를 재정의하고, 21개 소비 파일의 size props를 새 체계에 맞게 마이그레이션한다.
**Tech Stack:** Tailwind CSS 4, CVA (class-variance-authority), shadcn/ui
**Created:** 2026-03-15

---

## 설계: 새 버튼 크기 체계

### iOS ↔ 새 체계 매핑

```
iOS .mini/.small (28pt)  →  xs  (32px, h-8)   밀집 UI 전용
iOS .medium     (34pt)   →  sm  (36px, h-9)   보조 액션
iOS .regular    (34pt)   →  default (44px, h-11)  ★ 표준 — 대부분 여기
iOS .large      (50pt)   →  lg  (50px, h-[50px])  전체폭 CTA
```

### 크기 정의표

| Size | 높이 | Tailwind | font | px | gap | icon | radius | 용도 |
|------|------|----------|------|----|-----|------|--------|------|
| **xs** | 32px | h-8 | text-xs (12px) | px-3 | gap-1 | size-3.5 | rounded-lg | 필터 칩, 인라인 토글, 밀집 도구 모음 |
| **sm** | 36px | h-9 | text-sm (14px) | px-3.5 | gap-1.5 | size-4 | rounded-xl | 보조 액션, 뷰 토글, 폼 내 세컨더리 |
| **default** | 44px | h-11 | text-sm (14px) | px-4 | gap-2 | size-4 | rounded-xl | **표준**. 장소 추가, 분석, 저장, 수정, 삭제 |
| **lg** | 50px | h-[50px] | text-base (16px) | px-5 | gap-2 | size-5 | rounded-2xl | 전체폭 CTA: 로그인, 가입, 초대 수락 |

### 아이콘 버튼 정의표

| Size | 크기 | Tailwind | icon | 용도 |
|------|------|----------|------|------|
| **icon-xs** | 32×32 | size-8 | size-3.5 | 밀집 아이콘 |
| **icon-sm** | 36×36 | size-9 | size-4 | 도구 모음 |
| **icon** | 44×44 | size-11 | size-5 | **표준**. 닫기, 뒤로가기 |
| **icon-lg** | 50×50 | size-[50px] | size-5 | 플로팅 액션 |

### 핵심 원칙

1. **44px = 새로운 기본**
   - `default` 크기가 Apple HIG 최소 터치 타겟과 동일
   - 개발자가 `size="sm"`을 습관적으로 쓰는 것을 방지
   - size prop 없이 쓰면 자동으로 44px = 접근성 충족

2. **xs도 WCAG AA 충족**
   - xs(32px)도 WCAG 2.2 AA 최소(24px)를 초과
   - 하지만 44px 미달이므로 **밀집 UI에서만** 사용 권장

3. **radius도 크기에 비례**
   - xs: rounded-lg (8px)
   - sm/default: rounded-xl (12px)
   - lg: rounded-2xl (16px)

### 마이그레이션 매핑

현재 코드의 size props를 새 체계로 변환하는 규칙:

| 현재 | 맥락 | 새 값 | 이유 |
|------|------|-------|------|
| `size="sm"` | Primary action (장소 추가, 저장 등) | `size="default"` | 주요 액션은 44px |
| `size="sm"` | 뷰 토글, 필터 | `size="xs"` | 밀집 그룹에서는 xs 허용 |
| `size="sm"` | 보조 액션 (수정, YouTube 등) | `size="sm"` | 36px로 상향 (기존 28→36) |
| (default, 암묵적) | 일반 버튼 | `size="default"` | 32→44px 상향 |
| `size="lg"` | CTA (초대 수락) | `size="lg"` | 36→50px 상향 |
| `size="icon-sm"` | 닫기 버튼 | `size="icon"` | 28→44px 상향 |
| `size="icon"` | 일반 아이콘 | `size="icon"` | 32→44px 상향 |

---

## Current Phase

Phase 1: Core Component — Status: pending

## Phases

### Phase 1: Core Component
- [ ] `button.tsx`의 size variants 재정의
- [ ] 새 크기 체계가 기존 variant(default, outline, ghost 등)와 호환되는지 확인
- [ ] 빌드 확인
- **Status:** pending

### Phase 2: 주요 화면 마이그레이션
- [ ] `places/page.tsx` — 상단 액션 바 (목록/지도 토글, 비교, YouTube, 장소 추가)
- [ ] `places/[placeId]/page.tsx` — 장소 상세 액션 버튼 (일정 추가, 수정, 삭제)
- [ ] `schedule/page.tsx` — 일정 뷰 토글 (플래너/동선)
- [ ] `budget/page.tsx` — 예산 액션 버튼
- [ ] `journal/page.tsx` — 일지 액션 버튼
- [ ] `members/page.tsx` — 멤버 관리 버튼
- **Status:** pending

### Phase 3: 공통 컴포넌트 마이그레이션
- [ ] `youtube-place-picker.tsx` — 분석/취소/추가 버튼
- [ ] `place-detail-drawer.tsx` — 장소 상세 드로어 액션
- [ ] `place-form.tsx` — 폼 버튼
- [ ] `install-banner.tsx` — PWA 설치 배너 버튼
- [ ] `ai-chat-fab.tsx` — AI 채팅 FAB 및 내부 버튼
- [ ] `share-target/page.tsx` — 공유 타겟 버튼
- [ ] `schedule/planner-view.tsx` — 플래너 뷰 버튼
- [ ] `schedule/draggable-item.tsx` — 드래그 아이템 액션
- [ ] `trip-header.tsx` — 여행 헤더 버튼
- **Status:** pending

### Phase 4: 시스템 컴포넌트
- [ ] `sheet.tsx` — 닫기 버튼 icon-sm → icon
- [ ] `dialog.tsx` — 닫기 버튼 icon-sm → icon
- [ ] `calendar.tsx` — 날짜 네비게이션 버튼
- [ ] 로그인/가입 페이지 — CTA 버튼 lg 적용
- [ ] 초대 수락 페이지 — CTA 버튼 lg 적용
- **Status:** pending

### Phase 5: 검증
- [ ] 프로덕션 빌드 성공 확인
- [ ] 주요 화면 시각적 확인 (Playwright 스크린샷)
- [ ] 버튼 크기 prop 남은 hardcode 없는지 grep 확인
- **Status:** pending

---

## Decisions Made

| # | Decision | Rationale | Date |
|---|----------|-----------|------|
| 1 | default = 44px | iOS HIG 최소 터치 타겟과 일치, 접근성 자동 충족 | 2026-03-15 |
| 2 | lg = 50px | iOS .large(50pt)와 일치, Hero CTA 전용 | 2026-03-15 |
| 3 | xs = 32px (기존 default) | 밀집 UI 전용, WCAG AA 충족 | 2026-03-15 |
| 4 | 일괄 마이그레이션 | 크기 정의가 바뀌므로 부분 적용 시 불일치 발생 | 2026-03-15 |

## Key Questions

- Input/Select 높이도 44px로 올릴 것인가? (현재 32px) → 이번 scope에서 제외, 별도 작업으로
