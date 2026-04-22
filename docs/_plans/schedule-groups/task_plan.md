# Plan: 일정 지역 그룹 (Schedule Area Groups)

## Goal

일정 아이템에 "지역 그룹" 계층을 추가하여, 시먼딩 같은 지역 안에 방문할 가게/카페를 하위 아이템으로 넣을 수 있는 구조를 만든다.

**계층 제한: 2레벨만** (지역 그룹 → 하위 장소). MVP에서는 3레벨 이상 중첩 불가.

## Approach

**Flat 상태 + 계산된 트리**: DB와 React 상태는 flat 구조(`parent_id`로 연결)를 유지하고, `useMemo`로 렌더링용 트리를 계산한다. 이 방식이 Supabase 동기화와 dnd-kit 충돌 감지 모두에 유리하다.

## Scope

### In
- `schedule_items`에 `parent_id`, `item_type` 컬럼 추가
- 지역 그룹 UI 컴포넌트 (접기/펼치기)
- 하위 장소 인덴트 표시
- 그룹 내 장소 순서 변경 (드래그앤드롭)
- 수집된 장소 → 그룹에 드롭 추가
- 그룹 생성/해제 UI

### Out
- 3레벨 이상 중첩 (MVP 이후)
- 그룹 간 하위 아이템 이동 (Phase 3)
- framer-motion 애니메이션 (Phase 4)
- 이동 거리/시간 자동 계산 (그룹 내)

---

## Phase 0: DB & 타입 기반

### Task 0.1: 마이그레이션 작성
- [ ] `docs/_plans/schedule-groups/migration.sql` — `parent_id`, `item_type` 컬럼 추가
- [ ] `schedule_items` 테이블에 `parent_id UUID REFERENCES schedule_items(id) NULL` 추가
- [ ] `item_type TEXT NOT NULL DEFAULT 'place' CHECK (item_type IN ('group', 'place'))` 추가
- [ ] 부분 인덱스: `CREATE INDEX idx_schedule_items_parent ON schedule_items(parent_id) WHERE parent_id IS NOT NULL`
- [ ] 마이그레이션 파일을 `supabase/migrations/`에 저장

### Task 0.2: TypeScript 타입 업데이트
- [ ] `src/types/database.ts` — `ScheduleItem` 인터페이스에 `parent_id`, `item_type`, `children?` 추가
- [ ] `item_type: "group" | "place"` 유니온 타입 정의

### Task 0.3: Supabase 쿼리 수정
- [ ] `use-schedule-data.ts` — 기존 쿼리 그대로 유지 (flat으로 조회)
- [ ] `buildItemTree(items)` 유틸리티 함수 작성 — flat → tree 변환 (useMemo에서 사용)

---

## Phase 1: 핵심 UI

### Task 1.1: GroupItem 컴포넌트
- [ ] `src/components/schedule/group-item.tsx` 신규 생성
- [ ] 접기/펼치기 토글 (chevron 아이콘)
- [ ] 지역명 + 하위 장소 개수 배지 ("3개 장소")
- [ ] 펼친 상태에서 하위 아이템 렌더링
- [ ] 시각적 구분: `bg-muted/40`, 두꺼운 왼쪽 보더, MapPin 아이콘

### Task 1.2: ChildItem 스타일
- [ ] 하위 장소: 인덴트(`ml-6`), 작은 폰트(`text-xs`), 점선 왼쪽 보더
- [ ] 기존 DraggableItem 재사용하되 `variant="child"` prop으로 스타일 분기

### Task 1.3: PlannerView 수정
- [ ] `buildItemTree()` 결과로 렌더링
- [ ] DayCard에서 그룹/일반 아이템 분기 렌더링
- [ ] 그룹 생성 버튼 ("지역 그룹 추가")

### Task 1.4: 그룹 생성/해제 폼
- [ ] ScheduleItemForm에 `item_type` 선택 추가
- [ ] 그룹 생성 시 `item_type: "group"`, `place_id: null`
- [ ] 그룹 해제 시 하위 장소를 상위로 승격

---

## Phase 2: 드래그앤드롭 기본

### Task 2.1: dnd-kit 데이터 확장
- [ ] SortableItemWrapper `data`에 `item_type`, `parent_id` 추가
- [ ] 그룹 droppable 존 설정 (`data.type = "group"`)

### Task 2.2: 충돌 감지 커스텀
- [ ] 네스티드 droppable용 collisionDetection 함수 작성
- [ ] 그룹 위 → 하위로 추가, 아이템 사이 → 순서 변경

### Task 2.3: 드래그 핸들러 수정
- [ ] `handleDragEnd` — 그룹/하위/일반 분기 처리
- [ ] 그룹 드래그 → 전체 그룹 이동
- [ ] 하위 장소 드래그 → 같은 그룹 내 순서 변경

### Task 2.4: 수집된 장소 → 그룹 드롭
- [ ] PlaceSidebar에서 장소를 그룹 위에 드롭하면 하위로 추가

---

## Phase 3: 검증

### Task 3.1: 통합 테스트
- [ ] 그룹 생성 → 하위 장소 추가 → 펼치기/접기
- [ ] 드래그앤드롭: 그룹 이동, 하위 순서 변경
- [ ] 그룹 삭제 시 하위 장소 처리 (승격 vs 같이 삭제)
- [ ] 모바일 터치 인터랙션

### Task 3.2: 빌드 & 타입체크
- [ ] `next build` 통과
- [ ] `tsc --noEmit` 에러 없음

---

## Readiness Check (7항목)

| # | 항목 | 상태 |
|---|------|------|
| 1 | 모든 Task에 구체적 파일 경로가 있는가? | ✅ |
| 2 | 각 Task의 완료 조건이 측정 가능한가? | ✅ |
| 3 | Task 간 의존 순서가 명확한가? | ✅ Phase 순서 |
| 4 | 기존 API/타입과의 호환성 확인 | ✅ item_type DEFAULT 'place' |
| 5 | 테스트 전략 포함 | ✅ Phase 3 |
| 6 | Phase 간 경계 명확 | ✅ 4 Phase |
| 7 | Open Question이 블로커가 아닌가? | ✅ |

**Score: 7/7 → 즉시 실행 가능**

## 결정 사항

- **그룹 삭제 시**: 유저에게 선택 (하위 장소 상위 승격 vs 같이 삭제)
- **그룹 내 이동 거리 자동 계산**: MVP에서 제외
