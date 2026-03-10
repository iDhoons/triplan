# Responsive Navigation Implementation Plan

**Goal:** 모바일/데스크톱 모두에서 동작하는 2-level 반응형 네비게이션 시스템 구축
**Architecture:** Global Nav(BottomNav/Sidebar) + Local Nav(Trip TabNav) 분리, NavItems 공유 배열로 단일 진실 원천
**Tech Stack:** Next.js App Router, Tailwind v4, shadcn/ui, Lucide React

---

## 데이터 흐름 분석

### 현재 데이터 흐름

```
[Supabase Auth] → useAuthStore (Zustand)
       ↓
[AppShell] ← auth gate + profile fetch
  ├── OfflineBanner
  ├── <main>{children}</main>
  └── BottomNav (navItems: 하드코딩 1개)

[Dashboard Page]
  ├── supabase.from("trips").select → trips[]
  ├── UserMenu ← useAuthStore.user  ← (중복 렌더링 #1)
  └── Card click → router.push("/trips/{id}/places")

[TripLayout] ← "use client" 전체
  ├── supabase.from("trips").select → trip (state)
  ├── tabs: 하드코딩 5개
  ├── handleSaveEdit → supabase update + schedules 동기화 (비즈니스 로직)
  ├── UserMenu ← useAuthStore.user  ← (중복 렌더링 #2)
  ├── OnlineMembers ← RealtimeProvider
  ├── ActivityToast ← RealtimeProvider
  └── AiChatFab ← tripId, useAuthStore.user
```

### 목표 데이터 흐름

```
[Supabase Auth] → useAuthStore (Zustand)
       ↓
[AppShell] ← auth gate + profile fetch
  ├── OfflineBanner
  ├── [Desktop] Sidebar ← navigation.ts (globalNav + tripNav)
  │     ├── GlobalNav section ← usePathname
  │     ├── TripNav section ← tripId from URL (optional)
  │     └── UserMenu ← useAuthStore.user (단일 렌더링)
  ├── <main>{children}</main>
  └── [Mobile] BottomNav ← navigation.ts (globalNav)

[Dashboard Page]
  ├── supabase.from("trips").select → trips[]
  └── (UserMenu 제거 → AppShell로 이동)

[TripLayout] ← 경량화 (~50줄)
  ├── TripHeader ← trip fetch
  ├── TripTabNav ← navigation.ts (tripNav) + usePathname
  ├── TripEditDialog ← trip state + 스케줄 동기화 로직
  ├── RealtimeProvider + ActivityToast
  ├── {children}
  └── AiChatFab ← tripId
```

### 공유 데이터 소스

```
navigation.ts (Single Source of Truth)
  ├── globalNav: NavItem[] → BottomNav, Sidebar(글로벌 섹션)
  └── tripNav: NavItem[] → TripTabNav, Sidebar(로컬 섹션)
```

---

## Phase 0: 접근성 핫픽스

> 구조 변경 없이 즉시 적용 가능한 접근성 수정

### Task 0-1: BottomNav ARIA 속성 추가

**Files:**
- Modify: `src/components/layout/bottom-nav.tsx`

**체크리스트:**
- [ ] `<nav>`에 `aria-label="앱 메뉴"` 추가
- [ ] 활성 항목에 `aria-current="page"` 동적 추가
- [ ] 이모지 🏠을 Lucide `Home` 아이콘으로 교체 (`import { Home } from "lucide-react"`)
- [ ] `<span className="text-lg">{item.icon}</span>` → `<item.icon className="w-5 h-5" />`
- [ ] **검증**: 브라우저에서 BottomNav 렌더링 확인, 아이콘 표시 확인

---

### Task 0-2: TripLayout 탭 네비 접근성

**Files:**
- Modify: `src/app/(main)/trips/[tripId]/layout.tsx` (Line 183~198)

**체크리스트:**
- [ ] `<nav>` (Line 183)에 `aria-label="여행 탭"` 추가
- [ ] 활성 탭 Link에 `aria-current="page"` 추가 (activeTab?.href === tab.href 조건)
- [ ] **검증**: DevTools에서 `<nav>` 요소에 aria-label 확인, 활성 탭에 aria-current 확인

---

### Task 0-3: 여행 제목 편집 hover 전용 제거 + button 교체

**Files:**
- Modify: `src/app/(main)/trips/[tripId]/layout.tsx` (Line 161~175)

**체크리스트:**
- [ ] Line 161의 `<div className="cursor-pointer group" onClick={openEdit}>` → `<button type="button" onClick={openEdit} className="text-left group">`로 교체
- [ ] Line 168의 Pencil 아이콘에서 `opacity-0 group-hover:opacity-100` 제거 → `opacity-60 group-hover:opacity-100`으로 변경 (항상 보이되 hover시 강조)
- [ ] `title="클릭하여 수정"` → `aria-label="여행 정보 수정"`으로 변경
- [ ] **검증**: 모바일 화면(DevTools 375px)에서 연필 아이콘이 보이는지 확인, Tab 키로 포커스 가능한지 확인

---

### Task 0-4: 뒤로가기 버튼 접근성

**Files:**
- Modify: `src/app/(main)/trips/[tripId]/layout.tsx` (Line 154~160)

**체크리스트:**
- [ ] Button에 `aria-label="대시보드로 돌아가기"` 추가
- [ ] `&larr;` HTML entity → Lucide `ArrowLeft` 아이콘으로 교체 (`import { ArrowLeft } from "lucide-react"`)
- [ ] **검증**: 스크린리더에서 "대시보드로 돌아가기, 버튼"으로 읽히는지 확인 (VoiceOver)

---

### Task 0-5: AI FAB 접근성 보강

**Files:**
- Modify: `src/components/ai/ai-chat-fab.tsx` (Line 153~225)

**체크리스트:**
- [ ] FAB 버튼(Line 157)에 `aria-expanded={open}` 추가
- [ ] 메시지 영역(Line 202)에 `aria-live="polite"` 추가
- [ ] 로딩 인디케이터(Line 211~224) 감싸는 div에 `role="status"` + `aria-label="AI가 응답을 작성하고 있습니다"` 추가
- [ ] **검증**: Sheet 열림/닫힘 시 aria-expanded 값 토글 확인, 새 메시지 추가 시 aria-live 영역 반응 확인

---

### Phase 0 완료 체크리스트
- [ ] `npm run build` 에러 없음
- [ ] 모바일(375px) 시뮬레이션에서 연필 아이콘 보임
- [ ] Tab 키로 BottomNav → 뒤로가기 → 제목편집 → 탭 → 콘텐츠 순서로 포커스 이동
- [ ] 모든 `<nav>`에 aria-label 존재
- [ ] 모든 활성 네비 항목에 aria-current="page" 존재

---

## Phase 1: AppShell 승격 + BottomNav 확장

> Strangler Fig 패턴 — AppShell에 글로벌 네비 기반 확립

### Task 1-1: NavItems 공유 설정 생성

**Files:**
- Create: `src/config/navigation.ts`

**체크리스트:**
- [ ] `NavItem` 타입 정의: `{ href: string; label: string; icon: LucideIcon; showIn: ('bottom' | 'sidebar' | 'both')[] }`
- [ ] `globalNav` 배열 정의:
  ```
  - { href: "/dashboard", label: "내 여행", icon: Home, showIn: ["both"] }
  - { href: "/explore", label: "탐색", icon: Compass, showIn: ["both"] }
  - { href: "/notifications", label: "알림", icon: Bell, showIn: ["both"] }
  - { href: "/profile", label: "내 정보", icon: User, showIn: ["both"] }
  ```
- [ ] `tripNav` 배열 정의:
  ```
  - { href: "places", label: "장소", icon: MapPin }
  - { href: "schedule", label: "일정", icon: Calendar }
  - { href: "budget", label: "예산", icon: Wallet }
  - { href: "journal", label: "후기", icon: BookOpen }
  - { href: "members", label: "멤버", icon: Users }
  ```
- [ ] `getTripTabHref(tripId: string, tabHref: string): string` 헬퍼 함수
- [ ] **검증**: 타입 에러 없이 import 가능한지 확인

---

### Task 1-2: BottomNav 확장 (4개 항목)

**Files:**
- Modify: `src/components/layout/bottom-nav.tsx` (전면 수정)

**체크리스트:**
- [ ] `navItems` 하드코딩 제거 → `import { globalNav } from "@/config/navigation"` 사용
- [ ] 이모지 아이콘 제거 → `item.icon` 컴포넌트 사용 (Lucide)
- [ ] `<nav aria-label="앱 메뉴">` 유지 (Phase 0에서 추가됨)
- [ ] `aria-current="page"` 유지 (Phase 0에서 추가됨)
- [ ] 4개 항목이 균등 배치되는지 확인 (`flex justify-around`)
- [ ] 활성 상태 아이콘 색상 + 라벨 font-medium
- [ ] dark mode에서 bg-background/border-border로 테마 대응
- [ ] **검증**: 모바일(375px)에서 4개 아이콘+라벨 모두 보이고 겹치지 않는지 확인
- [ ] **검증**: 각 탭 클릭 시 정확한 경로로 이동하는지 확인

---

### Task 1-3: AppShell에 데스크톱 헤더 추가

**Files:**
- Modify: `src/components/layout/app-shell.tsx`

**체크리스트:**
- [ ] `hidden md:flex` 조건으로 데스크톱 전용 헤더 바 추가 (상단 고정)
  ```
  <header className="hidden md:flex items-center justify-between h-14 px-6 border-b bg-background fixed top-0 left-0 right-0 z-40">
    <div>앱 로고/이름</div>
    <nav>글로벌 링크들</nav>
    <UserMenu />
  </header>
  ```
- [ ] `globalNav`에서 네비 링크 렌더링 (현재 경로 하이라이트)
- [ ] 데스크톱: `pt-14`(헤더 높이) 추가, 모바일: `pt-0` 유지
- [ ] 기존 `pb-16 md:pb-0` 유지 (BottomNav 공간)
- [ ] `<nav aria-label="메인 네비게이션">`으로 데스크톱 네비에도 aria-label
- [ ] **검증**: 모바일(375px)에서 헤더 숨겨지고 BottomNav 보이는지
- [ ] **검증**: 데스크톱(1024px)에서 상단 헤더 보이고 BottomNav 숨겨지는지
- [ ] **검증**: 네비 링크 클릭 시 라우팅 정상 동작

---

### Task 1-4: Dashboard 헤더에서 UserMenu 제거

**Files:**
- Modify: `src/app/(main)/dashboard/page.tsx` (Line 7, 100, 154)

**체크리스트:**
- [ ] `import { UserMenu }` 제거
- [ ] Line 154의 `<UserMenu />` 제거
- [ ] 헤더 우측에 `+ 새 여행` 버튼만 남김
- [ ] **검증**: Dashboard 페이지에 UserMenu 없고, AppShell 데스크톱 헤더에 UserMenu 존재하는지 확인
- [ ] **검증**: 모바일에서 UserMenu가 BottomNav의 "내 정보" 탭으로 대체되는지 확인 (현재는 /profile 경로 미구현이므로 placeholder 표시)

---

### Phase 1 완료 체크리스트
- [ ] `npm run build` 에러 없음
- [ ] 모바일: BottomNav 4개 항목(내 여행/탐색/알림/내 정보) 표시
- [ ] 데스크톱: 상단 헤더에 글로벌 네비 + UserMenu 표시
- [ ] Dashboard: UserMenu 중복 제거됨
- [ ] navigation.ts가 단일 진실 원천으로 동작
- [ ] 모든 네비 항목에 Lucide 아이콘 사용
- [ ] 라우팅: /dashboard, /explore(placeholder), /notifications(placeholder), /profile(placeholder)

---

## Phase 2: TripLayout God Component 분해

> 264줄 → ~50줄로 경량화, 비즈니스 로직 분리

### Task 2-1: TripHeader 추출

**Files:**
- Create: `src/components/trip/trip-header.tsx`
- Modify: `src/app/(main)/trips/[tripId]/layout.tsx`

**체크리스트:**
- [ ] `TripHeader` 컴포넌트 생성 — props: `{ trip: Trip | null; onEditClick: () => void }`
- [ ] layout.tsx Line 152~181의 `<header>` 블록 전체를 TripHeader로 이동
- [ ] 뒤로가기 버튼 포함 (`ArrowLeft` + `aria-label="대시보드로 돌아가기"`)
- [ ] 여행 제목 편집 트리거 (`<button>` + Pencil 아이콘, 항상 표시)
- [ ] OnlineMembers 포함
- [ ] UserMenu는 **제거** (AppShell로 이동 완료)
- [ ] **검증**: TripHeader가 독립적으로 렌더링되는지 확인
- [ ] **검증**: onEditClick 콜백이 정상 동작하는지 확인

---

### Task 2-2: TripEditDialog 추출

**Files:**
- Create: `src/components/trip/trip-edit-dialog.tsx`
- Modify: `src/app/(main)/trips/[tripId]/layout.tsx`

**체크리스트:**
- [ ] `TripEditDialog` 컴포넌트 생성 — props: `{ trip: Trip; open: boolean; onOpenChange: (open: boolean) => void; onSaved: (updated: Trip) => void }`
- [ ] layout.tsx Line 44~49의 편집 폼 상태 (editTitle, editDestination, editStartDate, editEndDate, saving) 이동
- [ ] layout.tsx Line 64~71의 `openEdit()` 함수 이동 (Dialog 내부에서 자체 관리)
- [ ] layout.tsx Line 73~142의 `handleSaveEdit()` 함수 전체 이동 (스케줄 동기화 포함)
- [ ] layout.tsx Line 204~261의 Dialog JSX 전체 이동
- [ ] `onSaved` 콜백으로 layout에 업데이트된 trip 전달
- [ ] **검증**: 여행 수정 → 저장 → trip 상태 업데이트 + toast 확인
- [ ] **검증**: 날짜 변경 시 스케줄 동기화 정상 동작 확인

---

### Task 2-3: TripTabNav 추출

**Files:**
- Create: `src/components/trip/trip-tab-nav.tsx`
- Modify: `src/app/(main)/trips/[tripId]/layout.tsx`

**체크리스트:**
- [ ] `TripTabNav` 컴포넌트 생성 — props: `{ tripId: string }`
- [ ] `import { tripNav } from "@/config/navigation"` 사용 (하드코딩 tabs 제거)
- [ ] 각 탭에 아이콘 추가: `<tab.icon className="w-4 h-4" />` + label
- [ ] `<nav aria-label="여행 탭">` 유지
- [ ] `aria-current="page"` 유지
- [ ] 우측 fade gradient 추가 (스크롤 힌트): `mask-image: linear-gradient(to right, black 85%, transparent)`
- [ ] `overflow-x-auto` 유지, `scrollbar-hide` 클래스 추가
- [ ] 데스크톱에서도 표시 유지 (Phase 3에서 사이드바 통합 시 조건부 숨김)
- [ ] **검증**: 모바일(375px)에서 5개 탭 + 아이콘 + 스크롤 힌트 표시
- [ ] **검증**: 탭 클릭 시 정확한 경로 이동

---

### Task 2-4: TripLayout 경량화

**Files:**
- Modify: `src/app/(main)/trips/[tripId]/layout.tsx` (264줄 → ~50줄)

**체크리스트:**
- [ ] 불필요한 import 제거 (Pencil, Input, Label, Dialog 등)
- [ ] 편집 관련 state 제거 (editTitle, editDestination, editStartDate, editEndDate, saving)
- [ ] openEdit, handleSaveEdit 함수 제거
- [ ] tabs 하드코딩 배열 제거
- [ ] 최종 구조:
  ```tsx
  <RealtimeProvider tripId={tripId}>
    <ActivityToast />
    <div>
      <TripHeader trip={trip} onEditClick={() => setEditOpen(true)} />
      <TripTabNav tripId={tripId} />
      {children}
      <AiChatFab />
    </div>
    <TripEditDialog
      trip={trip}
      open={editOpen}
      onOpenChange={setEditOpen}
      onSaved={setTrip}
    />
  </RealtimeProvider>
  ```
- [ ] trip fetch useEffect 유지 (layout 레벨에서 필요)
- [ ] **검증**: `npm run build` 에러 없음
- [ ] **검증**: 여행 상세 페이지 전체 기능 정상 동작 (탭 이동, 수정, AI, 실시간)

---

### Phase 2 완료 체크리스트
- [ ] `npm run build` 에러 없음
- [ ] TripLayout이 ~50줄 이하
- [ ] TripHeader, TripEditDialog, TripTabNav 3개 파일 독립 존재
- [ ] navigation.ts의 tripNav가 TripTabNav에서 사용됨
- [ ] 탭에 아이콘 표시됨
- [ ] 스크롤 힌트(fade gradient) 동작
- [ ] 여행 수정 기능 정상 (제목/여행지/날짜 변경 + 스케줄 동기화)
- [ ] 실시간 기능 정상 (OnlineMembers, ActivityToast)

---

## Phase 3: 데스크톱 사이드바 + 반응형 전환

> 데스크톱에서 사이드바로 글로벌+로컬 네비 통합

### Task 3-1: Sidebar 컴포넌트 생성

**Files:**
- Create: `src/components/layout/sidebar.tsx`

**체크리스트:**
- [ ] `Sidebar` 컴포넌트 생성 — `hidden md:flex` (데스크톱 전용)
- [ ] `w-64 fixed left-0 top-0 bottom-0 border-r bg-background z-30 flex flex-col`
- [ ] 상단: 앱 이름/로고 영역 (`h-14 px-4 flex items-center border-b`)
- [ ] 글로벌 섹션: `globalNav` 순회, 활성 항목 하이라이트
  - `<nav aria-label="메인 네비게이션">`
  - 각 항목: `<Link>` + 아이콘 + 라벨, `aria-current="page"` 동적
- [ ] 구분선
- [ ] 로컬 섹션 (Trip 컨텍스트일 때만):
  - `usePathname()`에서 `/trips/[tripId]` 패턴 감지
  - 여행 제목 표시 (작은 텍스트)
  - `tripNav` 순회, 아이콘 + 라벨
  - `<nav aria-label="여행 탭">`
- [ ] 하단: UserMenu (사이드바 하단 고정)
- [ ] **검증**: 1024px에서 사이드바 표시, 375px에서 숨겨짐
- [ ] **검증**: /dashboard에서 글로벌 섹션만, /trips/xxx/places에서 글로벌+로컬 표시

---

### Task 3-2: AppShell 반응형 레이아웃 완성

**Files:**
- Modify: `src/components/layout/app-shell.tsx`

**체크리스트:**
- [ ] Phase 1에서 추가한 데스크톱 헤더를 **제거** → Sidebar로 대체
- [ ] Sidebar import 및 렌더링 추가
- [ ] 메인 콘텐츠 영역에 `md:pl-64` 추가 (사이드바 너비만큼 좌측 패딩)
- [ ] 최종 구조:
  ```
  <div className="min-h-screen pb-16 md:pb-0 md:pl-64">
    <OfflineBanner />
    <Sidebar />
    <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
    <BottomNav />
  </div>
  ```
- [ ] **검증**: 모바일 — BottomNav 표시, 사이드바 숨김, 좌측 패딩 없음
- [ ] **검증**: 데스크톱 — 사이드바 표시, BottomNav 숨김, 좌측 패딩 적용
- [ ] **검증**: 콘텐츠가 사이드바에 가려지지 않음

---

### Task 3-3: TripLayout에서 UserMenu 제거

**Files:**
- Modify: `src/app/(main)/trips/[tripId]/layout.tsx` (또는 trip-header.tsx)

**체크리스트:**
- [ ] TripHeader에서 UserMenu import/렌더링 제거 (Sidebar/AppShell에서 관리)
- [ ] 헤더 우측에 OnlineMembers만 남김
- [ ] **검증**: Trip 페이지에서 UserMenu 중복 없음
- [ ] **검증**: 데스크톱 Sidebar 하단에 UserMenu 표시

---

### Task 3-4: TripTabNav 반응형 전환

**Files:**
- Modify: `src/components/trip/trip-tab-nav.tsx`

**체크리스트:**
- [ ] 데스크톱에서 `md:hidden` 적용 (사이드바의 로컬 섹션이 대체)
- [ ] 모바일에서만 수평 탭 표시
- [ ] **검증**: 모바일 — 상단 수평 탭 보임
- [ ] **검증**: 데스크톱 — 상단 탭 숨김, 사이드바 로컬 섹션에 동일 항목 표시
- [ ] **검증**: 기능 1:1 대응 — 모바일 탭 5개 = 사이드바 로컬 5개

---

### Task 3-5: AI FAB 위치 안정화

**Files:**
- Modify: `src/components/ai/ai-chat-fab.tsx`

**체크리스트:**
- [ ] 모바일: `bottom-20 right-4` → CSS 변수 기반 (`bottom-[calc(theme(spacing.16)+theme(spacing.4))]`)으로 BottomNav 높이 의존 제거 (또는 `bottom-[calc(4rem+1rem)]`)
- [ ] 데스크톱: `md:bottom-6 md:right-6` 유지
- [ ] z-index: BottomNav(z-50)보다 위에 있되 Sheet보다 아래 → `z-50` 유지 (DOM 순서로 처리)
- [ ] **검증**: 모바일에서 FAB가 BottomNav와 겹치지 않음
- [ ] **검증**: 데스크톱에서 FAB가 사이드바와 겹치지 않음
- [ ] **검증**: 화면 확대(200%)에서도 FAB 접근 가능

---

### Phase 3 완료 체크리스트
- [ ] `npm run build` 에러 없음
- [ ] 모바일(375px): BottomNav 4항목 + Trip 상단탭 5항목 + FAB
- [ ] 데스크톱(1024px): 사이드바(글로벌4+로컬5) + FAB
- [ ] UserMenu 단일 렌더링 (Sidebar 하단 또는 AppShell에서만)
- [ ] 모든 `<nav>`에 고유 aria-label
- [ ] 모든 활성 항목에 aria-current="page"
- [ ] 기능 1:1 대응: 모바일에서 접근 가능한 모든 경로가 데스크톱에서도 접근 가능
- [ ] navigation.ts가 유일한 네비 데이터 소스

---

## Phase 4: 마무리 & 품질 검증

### Task 4-1: Placeholder 페이지 생성

**Files:**
- Create: `src/app/(main)/explore/page.tsx`
- Create: `src/app/(main)/notifications/page.tsx`
- Create: `src/app/(main)/profile/page.tsx`

**체크리스트:**
- [ ] 각 페이지에 "준비 중" placeholder UI
- [ ] 라우팅 정상 동작 확인
- [ ] **검증**: BottomNav/Sidebar의 모든 링크가 404 없이 동작

---

### Task 4-2: 전체 반응형 테스트

**체크리스트:**
- [ ] 320px (iPhone SE): 모든 UI 요소 겹침 없음, BottomNav 4항목 표시
- [ ] 375px (iPhone 14): Trip 탭 5개 + 스크롤 힌트
- [ ] 768px (iPad): BottomNav → Sidebar 전환점 확인
- [ ] 1024px (Desktop): Sidebar + 콘텐츠 정상 레이아웃
- [ ] 1440px (Wide): max-w-6xl 콘텐츠 중앙 정렬

---

### Task 4-3: 키보드 & 스크린리더 테스트

**체크리스트:**
- [ ] Tab 키 순서: Sidebar/Header → 콘텐츠 → BottomNav (논리적 순서)
- [ ] `aria-label` 구분: "앱 메뉴" vs "메인 네비게이션" vs "여행 탭"
- [ ] `aria-current="page"` 모든 활성 네비 항목에 존재
- [ ] AI FAB `aria-expanded` 토글 정상
- [ ] AI 메시지 영역 `aria-live` 동작

---

### Task 4-4: Dark Mode 확인

**체크리스트:**
- [ ] BottomNav: bg-background/border-border 테마 대응
- [ ] Sidebar: bg-background/border-border 테마 대응
- [ ] 활성 상태 색상(text-primary)이 다크모드에서도 식별 가능

---

## 파일 변경 요약

| Phase | 신규 파일 | 수정 파일 | 삭제 파일 |
|-------|-----------|-----------|-----------|
| **0** | 0 | 3 (bottom-nav, layout, ai-chat-fab) | 0 |
| **1** | 1 (navigation.ts) | 3 (bottom-nav, app-shell, dashboard) | 0 |
| **2** | 3 (trip-header, trip-edit-dialog, trip-tab-nav) | 1 (layout) | 0 |
| **3** | 1 (sidebar) | 3 (app-shell, trip-tab-nav, ai-chat-fab) | 0 |
| **4** | 3 (explore, notifications, profile placeholder) | 0 | 0 |
| **합계** | **8개** | **10개 (중복 포함)** | **0개** |
