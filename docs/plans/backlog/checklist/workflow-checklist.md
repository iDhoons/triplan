# 체크리스트 기능 — 구현 워크플로우

> **작성일**: 2026-03-16
> **요구사항**: [requirements-checklist.md](./requirements-checklist.md)
> **예상 Phase**: 5단계, 각 Phase 독립 커밋 가능

---

## 아키텍처 결정 (기존 패턴 기반)

| 영역 | 결정 | 근거 |
|------|------|------|
| CRUD | Supabase 클라이언트 직접 (hooks) | `use-places.ts`, `use-budget.ts` 패턴 동일 |
| API Route | 불필요 (서버 전용 로직 없음) | 체크리스트는 순수 DB CRUD |
| 상태 | React Query + Supabase Realtime | 기존 패턴 |
| 드래그 | dnd-kit (이미 설치됨) | `schedule` 페이지에서 사용 중 |
| 타입 | `src/types/database.ts` 확장 | 기존 패턴 |

---

## Phase 1: DB 스키마 + 타입 (기반)

> **의존성**: 없음 (가장 먼저)
> **산출물**: 마이그레이션 SQL, TypeScript 타입, RLS 정책

### Task 1.1: Supabase 마이그레이션 작성

```
파일: supabase/migrations/20260316_checklist.sql
```

- `checklist_items` 테이블 생성
  - `id`, `trip_id`, `category`, `title`, `is_checked`, `priority`, `position`, `assigned_to`, `memo`, `created_by`, `created_at`, `updated_at`
  - FK: `trip_id → trips`, `assigned_to → profiles`, `created_by → profiles`
  - INDEX: `(trip_id, category, position)` — 카테고리별 정렬 조회 최적화
  - CHECK: `category IN ('documents','clothing','electronics','hygiene','shared','todo','shopping')`
  - CHECK: `priority IN ('high','medium','low')`
- `checklist_logs` 테이블 생성
  - `id`, `checklist_item_id`, `action`, `performed_by`, `performed_at`
  - FK: `checklist_item_id → checklist_items ON DELETE CASCADE`
  - INDEX: `(checklist_item_id, performed_at DESC)`
- `updated_at` 자동 갱신 트리거

### Task 1.2: RLS 정책

```
같은 마이그레이션 파일 내
```

- `checklist_items`:
  - SELECT: `trip_members`에 속한 사용자만
  - INSERT/UPDATE/DELETE: `trip_members` 중 role = 'admin' 또는 'editor'
  - UPDATE (is_checked만): 모든 `trip_members` (viewer 포함)
- `checklist_logs`:
  - SELECT: `trip_members`에 속한 사용자만
  - INSERT: 모든 `trip_members` (체크 토글 시 로그 기록)

### Task 1.3: TypeScript 타입 추가

```
파일: src/types/database.ts
```

- `ChecklistCategory` 유니온 타입
- `ChecklistPriority` 유니온 타입
- `ChecklistItem` 인터페이스
- `ChecklistLog` 인터페이스

### 검증 게이트
- [ ] 마이그레이션 적용 성공 (`supabase db push` 또는 대시보드)
- [ ] 타입이 DB 스키마와 일치

---

## Phase 2: 데이터 레이어 (Hook + Realtime)

> **의존성**: Phase 1 완료
> **산출물**: React Query 훅, Realtime 구독

### Task 2.1: `use-checklist.ts` 훅 작성

```
파일: src/hooks/use-checklist.ts
```

- `useChecklistItems(tripId)` — 전체 항목 조회 (카테고리별 정렬)
- `useChecklistLogs(itemId)` — 특정 항목의 히스토리 조회
- `useChecklistMutations(tripId)` — CRUD + 토글 mutation
  - `addItem(data)` — INSERT + position 계산 (카테고리 내 마지막)
  - `updateItem(id, data)` — UPDATE
  - `deleteItem(id)` — DELETE
  - `toggleCheck(id, isChecked)` — is_checked UPDATE + checklist_logs INSERT
  - `reorderItems(categoryItems)` — position 일괄 UPDATE
- 낙관적 업데이트: 토글, 정렬에 적용

### Task 2.2: RealtimeProvider에 체크리스트 구독 추가

```
파일: src/components/realtime/realtime-provider.tsx
```

- `checklist_items` 테이블 변경 → `["checklist", tripId]` invalidate
- `checklist_logs` 테이블 변경 → `["checklist_logs"]` invalidate

### 검증 게이트
- [ ] `useChecklistItems` 데이터 정상 반환
- [ ] 토글 시 낙관적 업데이트 즉시 반영
- [ ] 다른 탭에서 변경 시 Realtime 반영

---

## Phase 3: UI 컴포넌트 (핵심)

> **의존성**: Phase 2 완료
> **산출물**: 체크리스트 페이지 + 컴포넌트

### Task 3.1: 네비게이션 추가

```
파일: src/config/navigation.ts
```

- `tripNav`에 `{ href: "checklist", label: "체크리스트", icon: ListChecks }` 추가
- 위치: 예산 다음, 후기 앞 (index 3)

### Task 3.2: 페이지 생성

```
파일: src/app/(main)/trips/[tripId]/checklist/page.tsx
```

- 기존 `places/page.tsx` 또는 `budget/page.tsx` 패턴 참고
- 레이아웃: 상단 헤더(정렬 토글) + 카테고리 섹션 리스트 + 하단 추가 버튼(FAB)

### Task 3.3: 컴포넌트 분리

```
디렉토리: src/components/checklist/
```

| 컴포넌트 | 역할 |
|----------|------|
| `checklist-page.tsx` | 페이지 메인 (데이터 로딩, 정렬 상태) |
| `category-section.tsx` | 카테고리 헤더(아이콘+제목+진행률) + 항목 리스트 |
| `checklist-item.tsx` | 개별 항목 (체크박스, 제목, 담당자 아바타, 우선순위 뱃지) |
| `add-item-form.tsx` | 항목 추가 폼 (이름, 카테고리, 담당자, 메모, 우선순위) |
| `edit-item-sheet.tsx` | 항목 수정 바텀시트/다이얼로그 |
| `item-history.tsx` | 체크 히스토리 타임라인 |
| `sort-toggle.tsx` | 정렬 기준 전환 (생성순/급한순/수동) |

### 검증 게이트
- [ ] 체크리스트 탭이 네비게이션에 표시
- [ ] 카테고리별 섹션 렌더링
- [ ] 항목 추가/수정/삭제 동작
- [ ] 체크 토글 동작 + 히스토리 기록

---

## Phase 4: 드래그앤드롭 + 정렬

> **의존성**: Phase 3 완료
> **산출물**: 정렬 기능 완성

### Task 4.1: dnd-kit 연동

```
파일: src/components/checklist/category-section.tsx (수정)
```

- `@dnd-kit/core` + `@dnd-kit/sortable` 사용 (이미 설치됨)
- 카테고리 섹션 내에서만 드래그 가능 (카테고리 간 이동 불가)
- 드래그 완료 시 `reorderItems` mutation 호출
- 정렬 모드가 "수동"일 때만 드래그 핸들 표시

### Task 4.2: 정렬 토글 구현

```
파일: src/components/checklist/sort-toggle.tsx
```

- 3가지 모드: 생성순 | 급한순서 | 수동(드래그)
- 상태: `useState` (URL 파라미터 불필요, 로컬 UI 상태)
- 급한순서: `priority` DESC → `is_checked` ASC (미완료 우선)

### 검증 게이트
- [ ] 드래그로 순서 변경 후 새로고침해도 유지
- [ ] 정렬 모드 전환 시 즉시 반영
- [ ] 수동 모드가 아닐 때 드래그 핸들 숨김

---

## Phase 5: 권한 + 마무리

> **의존성**: Phase 4 완료
> **산출물**: 역할별 권한 적용, 문서 업데이트

### Task 5.1: viewer 권한 처리

```
파일: src/components/checklist/checklist-page.tsx (수정)
```

- 현재 사용자의 역할 조회 (`trip_members`)
- viewer: 추가/수정/삭제 버튼 숨김, 드래그 비활성, 체크 토글만 가능
- editor/admin: 전체 기능

### Task 5.2: 빈 상태 + 로딩 + 에러

- 항목 없을 때: "아직 준비물이 없어요. 추가해볼까요?" + CTA 버튼
- 로딩: Skeleton UI (기존 패턴)
- 에러: 에러 바운더리 또는 인라인 에러

### Task 5.3: 문서 업데이트

- `docs/PRD.md`: 체크리스트 기능 추가 (F 번호 부여)
- `docs/TRD.md`: 디렉토리 구조에 `checklist/` 추가, DB 테이블 추가
- `docs/TASKS.md`: 완료 항목으로 이동

### 검증 게이트
- [ ] viewer 계정으로 접속 시 CRUD 버튼 없음, 토글만 가능
- [ ] 빈 상태 UI 표시
- [ ] 문서 최신화

---

## 의존성 그래프

```
Phase 1 (DB + 타입)
    │
    ▼
Phase 2 (Hook + Realtime)
    │
    ▼
Phase 3 (UI 컴포넌트) ← 핵심, 가장 큰 Phase
    │
    ▼
Phase 4 (드래그 + 정렬)
    │
    ▼
Phase 5 (권한 + 마무리)
```

> 모든 Phase는 순차적. Phase 3이 가장 작업량 많음.

---

## 파일 생성/수정 요약

### 신규 생성 (8개)

| 파일 | Phase |
|------|-------|
| `supabase/migrations/20260316_checklist.sql` | 1 |
| `src/hooks/use-checklist.ts` | 2 |
| `src/app/(main)/trips/[tripId]/checklist/page.tsx` | 3 |
| `src/components/checklist/checklist-page.tsx` | 3 |
| `src/components/checklist/category-section.tsx` | 3 |
| `src/components/checklist/checklist-item.tsx` | 3 |
| `src/components/checklist/add-item-form.tsx` | 3 |
| `src/components/checklist/edit-item-sheet.tsx` | 3 |
| `src/components/checklist/item-history.tsx` | 3 |
| `src/components/checklist/sort-toggle.tsx` | 4 |

### 기존 수정 (4개)

| 파일 | Phase | 변경 내용 |
|------|-------|-----------|
| `src/types/database.ts` | 1 | 타입 추가 |
| `src/config/navigation.ts` | 3 | tripNav에 체크리스트 탭 추가 |
| `src/components/realtime/realtime-provider.tsx` | 2 | checklist 구독 추가 |
| `docs/PRD.md`, `docs/TRD.md`, `docs/TASKS.md` | 5 | 문서 업데이트 |

---

## 다음 단계

Phase 1부터 순차 구현 시작:
```
/sc:implement Phase 1 — DB 마이그레이션 + 타입
```
