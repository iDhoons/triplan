# 체크리스트 기능 — 아키텍처 설계서

> **작성일**: 2026-03-16
> **요구사항**: [requirements-checklist.md](./requirements-checklist.md)
> **워크플로우**: [workflow-checklist.md](./workflow-checklist.md)
> **상태**: 설계 확정

---

## 1. DB 스키마

### 1.1 checklist_items

```sql
CREATE TABLE checklist_items (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id     uuid        NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  category    text        NOT NULL
    CHECK (category IN ('documents','clothing','electronics','hygiene','shared','todo','shopping')),
  title       text        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  is_checked  boolean     NOT NULL DEFAULT false,
  priority    text        NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('high','medium','low')),
  position    integer     NOT NULL DEFAULT 0,
  assigned_to uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  memo        text        CHECK (memo IS NULL OR char_length(memo) <= 500),
  created_by  uuid        NOT NULL REFERENCES profiles(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- 카테고리별 정렬 조회 최적화
CREATE INDEX idx_checklist_items_trip_category
  ON checklist_items (trip_id, category, position);

-- 담당자별 필터 (v2 대비)
CREATE INDEX idx_checklist_items_assigned
  ON checklist_items (trip_id, assigned_to)
  WHERE assigned_to IS NOT NULL;
```

### 1.2 checklist_logs

```sql
CREATE TABLE checklist_logs (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_item_id uuid        NOT NULL REFERENCES checklist_items(id) ON DELETE CASCADE,
  action            text        NOT NULL CHECK (action IN ('checked','unchecked')),
  performed_by      uuid        NOT NULL REFERENCES profiles(id),
  performed_at      timestamptz NOT NULL DEFAULT now()
);

-- 항목별 히스토리 조회 (최신순)
CREATE INDEX idx_checklist_logs_item
  ON checklist_logs (checklist_item_id, performed_at DESC);
```

### 1.3 updated_at 트리거

```sql
-- 기존 함수 재사용 (없으면 생성)
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER checklist_items_updated_at
  BEFORE UPDATE ON checklist_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

### 1.4 Realtime 활성화

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE checklist_items;
ALTER PUBLICATION supabase_realtime ADD TABLE checklist_logs;
```

---

## 2. RLS 정책

기존 헬퍼 함수 `is_trip_member()`, `is_trip_editor_or_admin()` 재사용.

### 2.1 checklist_items

```sql
ALTER TABLE checklist_items ENABLE ROW LEVEL SECURITY;

-- SELECT: 여행 멤버만
CREATE POLICY "checklist_items_select_member"
  ON checklist_items FOR SELECT
  TO authenticated
  USING (is_trip_member(trip_id));

-- INSERT: editor/admin만
CREATE POLICY "checklist_items_insert_editor_admin"
  ON checklist_items FOR INSERT
  TO authenticated
  WITH CHECK (
    is_trip_editor_or_admin(trip_id)
    AND auth.uid() = created_by
  );

-- UPDATE: 분리 정책 (viewer는 is_checked만)
-- 정책 1: editor/admin은 모든 컬럼 수정 가능
CREATE POLICY "checklist_items_update_editor_admin"
  ON checklist_items FOR UPDATE
  TO authenticated
  USING (is_trip_editor_or_admin(trip_id))
  WITH CHECK (is_trip_editor_or_admin(trip_id));

-- 정책 2: viewer는 is_checked만 수정 가능
-- (RLS는 row-level이라 column 제한 불가 → 앱 레이어에서 enforced)
-- viewer의 UPDATE는 hook에서 toggleCheck만 호출하도록 제한
CREATE POLICY "checklist_items_update_member_check"
  ON checklist_items FOR UPDATE
  TO authenticated
  USING (
    is_trip_member(trip_id)
    AND NOT is_trip_editor_or_admin(trip_id)
  )
  WITH CHECK (
    is_trip_member(trip_id)
    -- viewer는 title, category 등 변경 방지 → 앱 레이어에서 enforced
  );

-- DELETE: editor/admin만
CREATE POLICY "checklist_items_delete_editor_admin"
  ON checklist_items FOR DELETE
  TO authenticated
  USING (is_trip_editor_or_admin(trip_id));
```

> **설계 결정**: Postgres RLS는 column-level 제한을 지원하지 않으므로, viewer의 `is_checked`만 수정 가능한 제약은 **앱 레이어(hook)에서 enforce**한다. RLS는 row-level 접근만 담당.

### 2.2 checklist_logs

```sql
ALTER TABLE checklist_logs ENABLE ROW LEVEL SECURITY;

-- SELECT: 여행 멤버만 (checklist_items → trip_id 조인)
CREATE POLICY "checklist_logs_select_member"
  ON checklist_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM checklist_items ci
      WHERE ci.id = checklist_logs.checklist_item_id
        AND is_trip_member(ci.trip_id)
    )
  );

-- INSERT: 모든 여행 멤버 (viewer 포함 — 체크 토글 로그)
CREATE POLICY "checklist_logs_insert_member"
  ON checklist_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = performed_by
    AND EXISTS (
      SELECT 1 FROM checklist_items ci
      WHERE ci.id = checklist_logs.checklist_item_id
        AND is_trip_member(ci.trip_id)
    )
  );
```

---

## 3. TypeScript 타입

```typescript
// src/types/database.ts에 추가

export type ChecklistCategory =
  | "documents"
  | "clothing"
  | "electronics"
  | "hygiene"
  | "shared"
  | "todo"
  | "shopping";

export type ChecklistPriority = "high" | "medium" | "low";

export interface ChecklistItem {
  id: string;
  trip_id: string;
  category: ChecklistCategory;
  title: string;
  is_checked: boolean;
  priority: ChecklistPriority;
  position: number;
  assigned_to: string | null;
  memo: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  // JOIN으로 가져올 수 있는 관계
  assignee?: Profile;
  creator?: Profile;
}

export interface ChecklistLog {
  id: string;
  checklist_item_id: string;
  action: "checked" | "unchecked";
  performed_by: string;
  performed_at: string;
  // JOIN
  performer?: Profile;
}
```

---

## 4. Hook API 설계

### 4.1 `useChecklistItems(tripId)`

```typescript
// 반환: UseQueryResult<ChecklistItem[]>
// 쿼리키: ["checklist", tripId]
// 정렬: category ASC, position ASC (DB에서)
// JOIN: assigned_to → profiles (assignee)

const { data, error } = await supabase
  .from("checklist_items")
  .select("*, assignee:profiles!assigned_to(id, display_name, avatar_url)")
  .eq("trip_id", tripId)
  .order("category")
  .order("position");
```

### 4.2 `useChecklistLogs(itemId)`

```typescript
// 반환: UseQueryResult<ChecklistLog[]>
// 쿼리키: ["checklist_logs", itemId]
// 활성: itemId가 있을 때만 (히스토리 팝업 열 때)

const { data, error } = await supabase
  .from("checklist_logs")
  .select("*, performer:profiles!performed_by(id, display_name, avatar_url)")
  .eq("checklist_item_id", itemId)
  .order("performed_at", { ascending: false })
  .limit(50);
```

### 4.3 `useChecklistMutations(tripId)`

```typescript
interface UseChecklistMutations {
  addItem: UseMutationResult<ChecklistItem, Error, {
    category: ChecklistCategory;
    title: string;
    priority?: ChecklistPriority;
    assigned_to?: string | null;
    memo?: string | null;
  }>;

  updateItem: UseMutationResult<ChecklistItem, Error, {
    id: string;
    title?: string;
    category?: ChecklistCategory;
    priority?: ChecklistPriority;
    assigned_to?: string | null;
    memo?: string | null;
  }>;

  deleteItem: UseMutationResult<void, Error, string>; // id

  toggleCheck: UseMutationResult<void, Error, {
    id: string;
    is_checked: boolean;
  }>;
  // → is_checked UPDATE + checklist_logs INSERT (트랜잭션)
  // → 낙관적 업데이트 적용

  reorderItems: UseMutationResult<void, Error, {
    category: ChecklistCategory;
    orderedIds: string[];
  }>;
  // → position 일괄 UPDATE
  // → 낙관적 업데이트 적용
}
```

### 4.4 toggleCheck 상세 (트랜잭션)

```typescript
// Supabase는 클라이언트에서 트랜잭션을 지원하지 않으므로
// 두 쿼리를 순차 실행. 실패 시 React Query가 롤백(invalidate).

async function toggleCheck({ id, is_checked }: { id: string; is_checked: boolean }) {
  // 1. is_checked 업데이트
  const { error: updateError } = await supabase
    .from("checklist_items")
    .update({ is_checked })
    .eq("id", id);
  if (updateError) throw updateError;

  // 2. 로그 기록
  const { error: logError } = await supabase
    .from("checklist_logs")
    .insert({
      checklist_item_id: id,
      action: is_checked ? "checked" : "unchecked",
      performed_by: user.id,
    });
  if (logError) throw logError;
}
```

### 4.5 낙관적 업데이트 전략

| Mutation | 낙관적 | 이유 |
|----------|--------|------|
| `toggleCheck` | ✅ | 빈번, 즉각 피드백 필요 |
| `reorderItems` | ✅ | 드래그 UX 끊김 방지 |
| `addItem` | ❌ | id 생성 필요, 서버 응답 대기 |
| `updateItem` | ❌ | 빈도 낮음, 정합성 우선 |
| `deleteItem` | ❌ | 실패 시 복구 어려움 |

---

## 5. Realtime 설계

### RealtimeProvider 확장

```typescript
// src/components/realtime/realtime-provider.tsx에 추가

// checklist_items 변경 구독
.on(
  "postgres_changes",
  {
    event: "*",
    schema: "public",
    table: "checklist_items",
    filter: `trip_id=eq.${tripId}`,
  },
  () => {
    queryClient.invalidateQueries({ queryKey: ["checklist", tripId] });
  }
)
// checklist_logs 변경 구독
.on(
  "postgres_changes",
  {
    event: "INSERT",
    schema: "public",
    table: "checklist_logs",
  },
  () => {
    queryClient.invalidateQueries({ queryKey: ["checklist_logs"] });
  }
)
```

---

## 6. 컴포넌트 아키텍처

### 6.1 컴포넌트 트리

```
checklist/page.tsx (라우트 엔트리)
└── ChecklistPage
    ├── SortToggle                    (정렬 모드 전환)
    ├── CategorySection[]             (7개 카테고리 반복)
    │   ├── CategoryHeader            (아이콘 + 제목 + 진행률 + 접기)
    │   └── SortableContext            (dnd-kit, 수동 모드 시)
    │       └── ChecklistItem[]
    │           ├── Checkbox           (체크 토글)
    │           ├── PriorityBadge      (high만 표시)
    │           ├── AssigneeAvatar     (담당자 아바타)
    │           └── ItemActions        (수정/삭제/히스토리)
    ├── AddItemForm                   (바텀시트 또는 인라인)
    ├── EditItemSheet                 (수정 바텀시트)
    └── ItemHistory                   (히스토리 팝업)
```

### 6.2 Props 인터페이스

```typescript
// ─── ChecklistPage ───
interface ChecklistPageProps {
  tripId: string;
  userRole: MemberRole;
}

// ─── SortToggle ───
type SortMode = "created" | "priority" | "manual";
interface SortToggleProps {
  value: SortMode;
  onChange: (mode: SortMode) => void;
}

// ─── CategorySection ───
interface CategorySectionProps {
  category: ChecklistCategory;
  items: ChecklistItem[];
  sortMode: SortMode;
  userRole: MemberRole;
  onToggle: (id: string, checked: boolean) => void;
  onEdit: (item: ChecklistItem) => void;
  onDelete: (id: string) => void;
  onReorder: (category: ChecklistCategory, orderedIds: string[]) => void;
  onShowHistory: (itemId: string) => void;
}

// ─── ChecklistItem ───
interface ChecklistItemProps {
  item: ChecklistItem;
  sortMode: SortMode;  // "manual"일 때만 드래그 핸들 표시
  userRole: MemberRole;
  onToggle: (checked: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
  onShowHistory: () => void;
}

// ─── AddItemForm ───
interface AddItemFormProps {
  tripId: string;
  members: TripMember[];
  defaultCategory?: ChecklistCategory;
  onSubmit: (data: AddItemPayload) => void;
  onClose: () => void;
}

interface AddItemPayload {
  category: ChecklistCategory;
  title: string;
  priority: ChecklistPriority;
  assigned_to: string | null;
  memo: string | null;
}

// ─── EditItemSheet ───
interface EditItemSheetProps {
  item: ChecklistItem;
  members: TripMember[];
  onSave: (data: Partial<ChecklistItem>) => void;
  onClose: () => void;
}

// ─── ItemHistory ───
interface ItemHistoryProps {
  itemId: string;
  itemTitle: string;
  onClose: () => void;
}
```

### 6.3 카테고리 메타데이터 (상수)

```typescript
// src/components/checklist/constants.ts

import {
  FileText, Shirt, Plug, Heart,
  Users, CheckSquare, ShoppingBag,
} from "lucide-react";

export const CHECKLIST_CATEGORIES = [
  { key: "documents",   label: "필수 서류",   icon: FileText },
  { key: "clothing",    label: "의류",        icon: Shirt },
  { key: "electronics", label: "전자기기",    icon: Plug },
  { key: "hygiene",     label: "세면/의약",   icon: Heart },
  { key: "shared",      label: "공동 준비물", icon: Users },
  { key: "todo",        label: "할 일",       icon: CheckSquare },
  { key: "shopping",    label: "쇼핑",        icon: ShoppingBag },
] as const;

export const PRIORITY_CONFIG = {
  high:   { label: "높음", className: "bg-red-100 text-red-700" },
  medium: { label: "보통", className: "" },  // 표시 없음
  low:    { label: "낮음", className: "text-muted-foreground" },
} as const;
```

---

## 7. 데이터 플로우

### 7.1 체크 토글

```
사용자 탭 → ChecklistItem.onToggle
  → useChecklistMutations.toggleCheck.mutate({ id, is_checked })
    → [낙관적] queryClient.setQueryData(["checklist", tripId], 즉시 반영)
    → [서버] supabase.update(checklist_items) + supabase.insert(checklist_logs)
    → [성공] 유지
    → [실패] queryClient.invalidateQueries → 서버 상태로 롤백
    → [Realtime] 다른 멤버에게 체크리스트 변경 브로드캐스트
```

### 7.2 드래그 정렬

```
드래그 종료 → CategorySection.onReorder
  → [낙관적] 로컬 items 순서 즉시 반영
  → useChecklistMutations.reorderItems.mutate({ category, orderedIds })
    → supabase.upsert(orderedIds.map((id, i) => ({ id, position: i })))
    → [실패] invalidateQueries → 원래 순서로 복원
```

### 7.3 정렬 모드 전환 (클라이언트 전용)

```
SortToggle.onChange(mode)
  → ChecklistPage.useState(sortMode)
  → CategorySection에 sortMode 전달
    → "created":  items.sort(a.created_at - b.created_at)
    → "priority": items.sort(priorityOrder[a.priority] - priorityOrder[b.priority])
                  → 같은 우선순위 내에서 is_checked=false 먼저
    → "manual":   items.sort(a.position - b.position) + 드래그 핸들 표시
```

---

## 8. 파일 구조 최종

```
src/
├── types/database.ts                                    # +4 타입
├── config/navigation.ts                                 # +1 nav item
├── hooks/use-checklist.ts                               # 신규
├── components/
│   ├── checklist/
│   │   ├── constants.ts                                 # 카테고리/우선순위 상수
│   │   ├── checklist-page.tsx                            # 페이지 메인
│   │   ├── category-section.tsx                          # 카테고리 섹션 + dnd
│   │   ├── checklist-item.tsx                            # 개별 항목
│   │   ├── add-item-form.tsx                             # 추가 폼
│   │   ├── edit-item-sheet.tsx                           # 수정 시트
│   │   ├── item-history.tsx                              # 히스토리 팝업
│   │   └── sort-toggle.tsx                               # 정렬 전환
│   └── realtime/realtime-provider.tsx                    # +2 구독
├── app/(main)/trips/[tripId]/checklist/page.tsx          # 라우트
supabase/
└── migrations/20260316_checklist.sql                     # 마이그레이션
```

---

## 9. 설계 결정 요약

| 결정 | 이유 |
|------|------|
| API Route 없음 | 서버 전용 로직 불필요. `use-places.ts` 패턴 동일 |
| viewer UPDATE RLS 분리 | column-level 제한 불가 → 앱 레이어에서 enforce |
| checklist_logs 별도 테이블 | activity_logs와 역할 다름 (항목별 히스토리 vs 전역 활동) |
| position은 category 내 | 카테고리 간 이동 불가. 정렬 범위를 category로 한정 |
| 낙관적 업데이트: 토글+정렬만 | 빈번한 동작만 낙관적. 나머지는 정합성 우선 |
| SortMode는 로컬 상태 | URL에 저장할 필요 없음. 세션 내 임시 설정 |
| 카테고리 7개 하드코딩 | v1 요구사항. v2에서 커스텀 카테고리 확장 가능하도록 text 타입 사용 |

---

## 10. 다음 단계

설계 확정 후 구현 시작:
```
/sc:implement Phase 1 — DB 마이그레이션 + 타입 정의
```
