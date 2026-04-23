"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import { useParams } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  pointerWithin,
  closestCenter,
  type CollisionDetection,
  type DragStartEvent,
  type DragEndEvent,
  type DragMoveEvent,
  type Modifier,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { ListOrdered, RouteIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import dynamic from "next/dynamic";
import { PlannerView } from "@/components/schedule/planner-view";
import { PlaceSidebar } from "@/components/schedule/place-sidebar";
import { DraggableItem } from "@/components/schedule/draggable-item";
import {
  ScheduleItemForm,
} from "@/components/schedule/schedule-item-form";
import { DayPickerSheet } from "@/components/schedule/day-picker-sheet";
import { UnscheduledFAB } from "@/components/schedule/unscheduled-fab";
import { DepartureAlert } from "@/components/schedule/departure-alert";
import { PlaceDetailDrawer } from "@/components/places/place-detail-drawer";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

const RouteMap = dynamic(
  () => import("@/components/maps/route-map").then((mod) => mod.RouteMap),
  {
    loading: () => (
      <div className="h-[520px] w-full rounded-lg bg-muted animate-pulse flex items-center justify-center">
        <RouteIcon className="size-8 text-muted-foreground/40" />
      </div>
    ),
    ssr: false,
  }
);
import { useScheduleData } from "@/hooks/use-schedule-data";
import { useScheduleActions } from "@/hooks/use-schedule-actions";
import type { Schedule, ScheduleItem, Place } from "@/types/database";

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------

// 원본 크기 그대로 드래그하므로 modifier 불필요
const OVERLAY_MODIFIERS: Modifier[] = [];

function formatDateShort(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("ko-KR", {
    month: "short",
    day: "numeric",
  });
}

// -----------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------
type ViewMode = "planner" | "route";

/** 드래그 중 삽입 위치 표시용 */
export interface InsertIndicator {
  scheduleId: string;
  insertIndex: number;
}

// -----------------------------------------------------------------------
// Page Component
// -----------------------------------------------------------------------
export default function SchedulePage() {
  const { tripId } = useParams<{ tripId: string }>();

  // --- Data (React Query) ---
  const {
    trip,
    schedules,
    places,
    loading,
    error,
    supabase,
    refetch,
  } = useScheduleData(tripId);

  // --- UI state ---
  const [viewMode, setViewMode] = useState<ViewMode>("planner");
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [routeDateIndex, setRouteDateIndex] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [targetScheduleId, setTargetScheduleId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<ScheduleItem | null>(null);
  const [activePlaceId, setActivePlaceId] = useState<string | null>(null);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [insertIndicator, setInsertIndicator] = useState<InsertIndicator | null>(null);
  const insertIndicatorRef = useRef<InsertIndicator | null>(null);
  const [groupDeleteTarget, setGroupDeleteTarget] = useState<{
    id: string;
    scheduleId: string;
    title: string;
    childCount: number;
  } | null>(null);

  // --- DayPickerSheet state ---
  const [dayPickerOpen, setDayPickerOpen] = useState(false);
  const [dayPickerPlace, setDayPickerPlace] = useState<Place | null>(null);
  const dayPickerTriggerRef = useRef<HTMLElement | null>(null);

  // --- Actions (React Query useMutation) ---
  const {
    handleFormSubmit,
    handleDeleteItem,
    handleReorderItems,
    handleDropPlace,
    handleMoveItem,
  } = useScheduleActions({
    tripId,
    supabase,
    targetScheduleId,
    editingItem,
  });

  // --- Computed ---
  const scheduledPlaceIds = useMemo(() => {
    const ids = new Set<string>();
    schedules.forEach((s) =>
      (s.items ?? []).forEach((i) => {
        if (i.place_id) ids.add(i.place_id);
      })
    );
    return ids;
  }, [schedules]);

  // --- Form handlers ---
  const handleOpenAddForm = (scheduleId: string) => {
    setTargetScheduleId(scheduleId);
    setEditingItem(null);
    setFormOpen(true);
  };

  const handleAddGroup = async (scheduleId: string) => {
    const targetSchedule = schedules.find((s) => s.id === scheduleId);
    const sortOrder = (targetSchedule?.items?.length ?? 0) + 1;
    await supabase.from("schedule_items").insert({
      schedule_id: scheduleId,
      title: "새 지역 그룹",
      item_type: "group",
      sort_order: sortOrder,
    });
    await refetch();
  };

  /** "+" 버튼 클릭 → DayPickerSheet 열기 */
  const handlePlaceAddClick = useCallback((place: Place, triggerEl: HTMLElement) => {
    setDayPickerPlace(place);
    dayPickerTriggerRef.current = triggerEl;
    setDayPickerOpen(true);
  }, []);

  /** DayPickerSheet에서 날짜 선택 → 장소 추가 */
  const handleAddPlaceToSchedule = useCallback(
    async (scheduleId: string, place: Place) => {
      const targetSchedule = schedules.find((s) => s.id === scheduleId);
      const sortOrder = (targetSchedule?.items?.length ?? 0) + 1;
      await handleDropPlace(scheduleId, place, sortOrder, schedules);
    },
    [schedules, handleDropPlace]
  );

  const handleOpenEditForm = (item: ScheduleItem) => {
    const parentSchedule = schedules.find((s) =>
      (s.items ?? []).some((i) => i.id === item.id)
    );
    setTargetScheduleId(parentSchedule?.id ?? null);
    setEditingItem(item);
    setFormOpen(true);
  };

  /** 그룹 삭제 시 하위 장소 처리 확인 래퍼 */
  const handleDeleteWithGroupCheck = useCallback(
    async (itemId: string, scheduleId: string) => {
      const schedule = schedules.find((s) => s.id === scheduleId);
      const item = schedule?.items?.find((i) => i.id === itemId);

      if (item?.item_type === "group" && (item.children?.length ?? 0) > 0) {
        setGroupDeleteTarget({
          id: itemId,
          scheduleId,
          title: item.title,
          childCount: item.children?.length ?? 0,
        });
        return;
      }

      await handleDeleteItem(itemId);
    },
    [schedules, handleDeleteItem]
  );

  /** 그룹 삭제 다이얼로그 선택 처리 */
  const handleGroupDeleteChoice = useCallback(
    async (mode: "promote" | "cascade") => {
      if (!groupDeleteTarget) return;
      const { id, scheduleId } = groupDeleteTarget;

      if (mode === "promote") {
        const schedule = schedules.find((s) => s.id === scheduleId);
        const group = schedule?.items?.find((i) => i.id === id);
        const children = group?.children ?? [];

        if (children.length > 0) {
          await Promise.all(
            children.map((child) =>
              supabase
                .from("schedule_items")
                .update({ parent_id: null })
                .eq("id", child.id)
            )
          );
        }
      }

      await handleDeleteItem(id);
      setGroupDeleteTarget(null);
    },
    [groupDeleteTarget, schedules, supabase, handleDeleteItem]
  );

  // --- DnD ---
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 10 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 300, tolerance: 5 } })
  );

  // 장소 드래그 여부를 ref로 추적 (collision callback 안에서 즉시 읽기 위해)
  const isDraggingPlaceRef = useRef(false);

  // 드래그 소스 스케줄 추적 (아이템 드래그 시 같은/다른 스케줄 구분)
  const dragSourceScheduleRef = useRef<string | null>(null);

  const collisionDetection: CollisionDetection = useCallback(
    (args) => {
      const pw = pointerWithin(args);
      if (pw.length > 0) {
        // 장소 드래그 시: 그룹 droppable 우선
        if (isDraggingPlaceRef.current) {
          const groupHits = pw.filter(
            (c) => String(c.id).startsWith("group-")
          );
          if (groupHits.length > 0) return groupHits;
        }
        // item droppable 우선 → 삽입 위치 감지
        const itemHits = pw.filter(
          (c) => !String(c.id).startsWith("schedule-") && !String(c.id).startsWith("group-")
        );
        if (itemHits.length > 0) return itemHits;
        // item 없으면 schedule droppable (빈 영역)
        return pw.filter((c) =>
          String(c.id).startsWith("schedule-")
        );
      }
      // 포인터가 드롭존 밖일 때: 아이템 드래그만 closestCenter 폴백
      if (!isDraggingPlaceRef.current) {
        return closestCenter(args);
      }
      return [];
    },
    []
  );

  const handleTopDragStart = (event: DragStartEvent) => {
    const id = event.active.id as string;
    if (id.startsWith("place-")) {
      setActivePlaceId(id);
      isDraggingPlaceRef.current = true;
      dragSourceScheduleRef.current = null;
    } else {
      setActiveItemId(id);
      isDraggingPlaceRef.current = false;
      // 소스 스케줄 기록 (최상위 + 그룹 내 하위 모두 검색)
      for (const s of schedules) {
        const items = s.items ?? [];
        if (items.some((i) => i.id === id)) {
          dragSourceScheduleRef.current = s.id;
          break;
        }
        // 그룹 내 하위 장소 검색
        if (items.some((i) => i.item_type === "group" && (i.children ?? []).some((c) => c.id === id))) {
          dragSourceScheduleRef.current = s.id;
          break;
        }
      }
    }
    setInsertIndicator(null);
    insertIndicatorRef.current = null;
  };

  /** 드래그 중 삽입 위치 계산 (장소 + 아이템 크로스 스케줄) */
  const handleDragMove = useCallback(
    (event: DragMoveEvent) => {
      const { over, activatorEvent, delta } = event;

      if (!over) {
        if (insertIndicatorRef.current) {
          insertIndicatorRef.current = null;
          setInsertIndicator(null);
        }
        return;
      }

      const overId = String(over.id);
      let newIndicator: InsertIndicator | null = null;

      // 그룹 droppable 위 — 삽입 라인 대신 그룹 하이라이트로 처리
      if (overId.startsWith("group-")) {
        if (insertIndicatorRef.current) {
          insertIndicatorRef.current = null;
          setInsertIndicator(null);
        }
        return;
      }

      if (overId.startsWith("schedule-")) {
        const scheduleId = overId.replace("schedule-", "");
        const schedule = schedules.find((s) => s.id === scheduleId);
        const itemCount = schedule?.items?.length ?? 0;

        if (itemCount === 0) {
          newIndicator = { scheduleId, insertIndex: 0 };
        } else {
          const pointerY =
            (activatorEvent as PointerEvent).clientY + delta.y;
          const midpoint = over.rect.top + over.rect.height / 2;
          newIndicator = {
            scheduleId,
            insertIndex: pointerY < midpoint ? 0 : itemCount,
          };
        }
      } else {
        for (const s of schedules) {
          const itemIdx = (s.items ?? []).findIndex((i) => i.id === overId);
          if (itemIdx === -1) continue;

          const pointerY =
            (activatorEvent as PointerEvent).clientY + delta.y;
          const midpoint =
            over.rect.top + over.rect.height / 2;

          newIndicator = {
            scheduleId: s.id,
            insertIndex: pointerY < midpoint ? itemIdx : itemIdx + 1,
          };
          break;
        }
      }

      // 같은 스케줄 내 아이템 드래그 → SortableContext가 처리하므로 라인 불필요
      if (
        !isDraggingPlaceRef.current &&
        newIndicator &&
        dragSourceScheduleRef.current === newIndicator.scheduleId
      ) {
        if (insertIndicatorRef.current) {
          insertIndicatorRef.current = null;
          setInsertIndicator(null);
        }
        return;
      }

      const prev = insertIndicatorRef.current;
      if (
        prev?.scheduleId !== newIndicator?.scheduleId ||
        prev?.insertIndex !== newIndicator?.insertIndex
      ) {
        insertIndicatorRef.current = newIndicator;
        setInsertIndicator(newIndicator);
      }
    },
    [schedules]
  );

  const handleTopDragEnd = async (event: DragEndEvent) => {
    // 삽입 위치 캡처 (state 초기화 전에)
    const indicator = insertIndicatorRef.current;

    setActivePlaceId(null);
    setActiveItemId(null);
    isDraggingPlaceRef.current = false;
    dragSourceScheduleRef.current = null;
    setInsertIndicator(null);
    insertIndicatorRef.current = null;

    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Case 1: 장소 카드 → 일정 또는 그룹에 드롭
    if (activeId.startsWith("place-")) {
      const place = active.data.current?.place as Place | undefined;
      if (!place) return;

      // 1a: 장소 → 그룹 드롭 (하위 장소로 추가)
      if (overId.startsWith("group-")) {
        const groupId = over.data.current?.groupId as string | undefined;
        const scheduleId = over.data.current?.scheduleId as string | undefined;
        if (!groupId || !scheduleId) return;

        const schedule = schedules.find((s) => s.id === scheduleId);
        const group = schedule?.items?.find((i) => i.id === groupId);
        const childCount = group?.children?.length ?? 0;

        const { error } = await supabase.from("schedule_items").insert({
          schedule_id: scheduleId,
          parent_id: groupId,
          title: place.name,
          place_id: place.id,
          sort_order: childCount + 1,
        });
        if (error) {
          toast.error("장소 추가에 실패했습니다.");
        } else {
          toast.success(`"${place.name}"을(를) 그룹에 추가했습니다.`);
          await refetch();
        }
        return;
      }

      // 1b: 장소 → 스케줄 드롭 (기존 로직)
      const dropScheduleId =
        indicator?.scheduleId ?? resolveDropScheduleId(overId, schedules);
      if (!dropScheduleId) return;

      const targetSchedule = schedules.find((s) => s.id === dropScheduleId);
      const totalItems = targetSchedule?.items?.length ?? 0;
      const sortOrder = (indicator?.insertIndex ?? totalItems) + 1;
      await handleDropPlace(dropScheduleId, place, sortOrder, schedules);
      return;
    }

    // Case 2: 하위 장소 재정렬 (같은 그룹 내)
    const activeData = active.data.current;
    const overData = over.data.current;
    if (
      activeData?.type === "child" &&
      overData?.type === "child" &&
      activeData.parent_id &&
      activeData.parent_id === overData.parent_id
    ) {
      const groupId = activeData.parent_id as string;
      for (const s of schedules) {
        const group = (s.items ?? []).find(
          (i) => i.id === groupId && i.item_type === "group"
        );
        if (!group) continue;

        const children = group.children ?? [];
        const oldIndex = children.findIndex((c) => c.id === activeId);
        const newIndex = children.findIndex((c) => c.id === overId);
        if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;

        const reordered = arrayMove(children, oldIndex, newIndex).map(
          (c, idx) => ({ ...c, sort_order: idx + 1 })
        );

        await Promise.all(
          reordered.map((child) =>
            supabase
              .from("schedule_items")
              .update({ sort_order: child.sort_order })
              .eq("id", child.id)
          )
        );
        await refetch();
        return;
      }
      return;
    }

    // Case 3: 최상위 아이템/그룹 재정렬 또는 크로스 스케줄 이동
    let sourceSchedule: Schedule | undefined;
    for (const s of schedules) {
      if ((s.items ?? []).some((i) => i.id === activeId)) {
        sourceSchedule = s;
        break;
      }
    }
    if (!sourceSchedule) return;

    const dropScheduleId =
      indicator?.scheduleId ?? resolveDropScheduleId(overId, schedules);
    if (!dropScheduleId) return;

    if (sourceSchedule.id === dropScheduleId) {
      const items = sourceSchedule.items ?? [];
      const oldIndex = items.findIndex((i) => i.id === activeId);
      const newIndex = items.findIndex((i) => i.id === overId);
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;

      const reordered = arrayMove(items, oldIndex, newIndex).map(
        (item, idx) => ({ ...item, sort_order: idx + 1 })
      );
      await handleReorderItems(sourceSchedule.id, reordered);
    } else {
      const totalItems =
        schedules.find((s) => s.id === dropScheduleId)?.items?.length ?? 0;
      const sortOrder = (indicator?.insertIndex ?? totalItems) + 1;
      await handleMoveItem(
        activeId,
        sourceSchedule.id,
        dropScheduleId,
        sortOrder,
        schedules
      );
    }
  };

  const activePlaceObj = useMemo(
    () =>
      activePlaceId
        ? places.find((p) => `place-${p.id}` === activePlaceId) ?? null
        : null,
    [activePlaceId, places]
  );

  const activeItemObj = useMemo(
    () => {
      if (!activeItemId) return null;
      for (const s of schedules) {
        for (const item of (s.items ?? [])) {
          if (item.id === activeItemId) return item;
          if (item.item_type === "group") {
            const child = (item.children ?? []).find((c) => c.id === activeItemId);
            if (child) return child;
          }
        }
      }
      return null;
    },
    [activeItemId, schedules]
  );

  // --- Loading ---
  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-48" />
        <div className="flex gap-6">
          <div className="flex-1 space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32 w-full rounded-xl" />
            ))}
          </div>
          <Skeleton className="hidden md:block w-56 h-96 rounded-xl" />
        </div>
      </div>
    );
  }

  // --- Error ---
  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-center">
        <p className="text-4xl">😵</p>
        <p className="font-medium text-foreground/80">데이터를 불러오지 못했어요</p>
        <p className="text-sm text-muted-foreground">네트워크 연결을 확인하고 다시 시도해주세요.</p>
        <Button variant="outline" onClick={() => refetch()}>다시 시도</Button>
      </div>
    );
  }

  // --- Render ---
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleTopDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleTopDragEnd}
    >
      <div className="space-y-4">
        {/* View mode toggle */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex rounded-lg border p-1 gap-1">
            <Button
              variant={viewMode === "planner" ? "secondary" : "ghost"}
              size="xs"
              onClick={() => setViewMode("planner")}
            >
              <ListOrdered className="w-3.5 h-3.5" />
              플래너
            </Button>
            <Button
              variant={viewMode === "route" ? "secondary" : "ghost"}
              size="xs"
              onClick={() => setViewMode("route")}
            >
              <RouteIcon className="w-3.5 h-3.5" />
              동선
            </Button>
          </div>

          <span className="text-xs text-muted-foreground">
            {trip ? `${formatDateShort(trip.start_date)} ~ ${formatDateShort(trip.end_date)}` : ""}
          </span>
        </div>

        {/* Main content + sidebar */}
        <div className="flex flex-col md:flex-row gap-6">
          {/* Main schedule area */}
          <div className="flex-1 min-w-0">
            {schedules.length === 0 ? (
              <div className="flex flex-col items-center gap-4 py-20 text-center animate-fade-in-up">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                  <ListOrdered className="h-8 w-8 text-primary/60" />
                </div>
                <div className="space-y-1">
                  <p className="font-medium text-foreground/80">아직 일정이 없어요</p>
                  <p className="text-sm text-muted-foreground">여행 날짜를 설정하면 일정이 자동으로 생성돼요!</p>
                </div>
              </div>
            ) : viewMode === "planner" ? (
              <PlannerView
                schedules={schedules}
                insertIndicator={insertIndicator}
                onAddItem={handleOpenAddForm}
                onAddGroup={handleAddGroup}
                onEditItem={handleOpenEditForm}
                onDeleteItem={handleDeleteWithGroupCheck}
                onPlaceClick={(place) => setSelectedPlace(place as Place)}
              />
            ) : (
              <RouteView
                schedules={schedules}
                routeDateIndex={routeDateIndex}
                onDateChange={setRouteDateIndex}
              />
            )}
          </div>

          {/* Place sidebar — 데스크톱만 표시, 모바일은 FAB으로 대체 */}
          <aside
            className={cn(
              "shrink-0 hidden md:block",
              "md:w-56",
              "md:sticky md:top-4",
              "md:h-[calc(100vh-6rem)] md:overflow-y-auto",
              "border rounded-xl p-3"
            )}
          >
            <PlaceSidebar
              places={places}
              scheduledPlaceIds={scheduledPlaceIds}
              onAddClick={handlePlaceAddClick}
            />
          </aside>
        </div>
      </div>

      {/* Drag overlay */}
      <DragOverlay
        modifiers={OVERLAY_MODIFIERS}
        dropAnimation={null}
      >
        {activePlaceObj && (
          <div className="pointer-events-none w-40 bg-card border rounded-lg p-2 shadow-xl text-xs font-medium scale-105">
            {activePlaceObj.name}
          </div>
        )}
        {activeItemObj && (
          <div className="pointer-events-none shadow-xl">
            <DraggableItem
              item={activeItemObj}
              orderNumber={
                schedules
                  .flatMap((s) => s.items ?? [])
                  .findIndex((i) => i.id === activeItemObj.id) + 1
              }
              onEdit={() => {}}
              onDelete={() => {}}
              isDragging
            />
          </div>
        )}
      </DragOverlay>

      {/* Item add/edit form */}
      <ScheduleItemForm
        open={formOpen}
        onOpenChange={setFormOpen}
        editingItem={editingItem}
        places={places}
        onSubmit={(data) => handleFormSubmit(data, schedules)}
      />

      {/* Tap-to-Assign: 날짜 선택 시트 */}
      <DayPickerSheet
        open={dayPickerOpen}
        onOpenChange={setDayPickerOpen}
        place={dayPickerPlace}
        schedules={schedules}
        onSelect={handleAddPlaceToSchedule}
      />

      {/* 모바일 전용: 미배치 장소 FAB */}
      <UnscheduledFAB
        places={places}
        scheduledPlaceIds={scheduledPlaceIds}
        onAddClick={handlePlaceAddClick}
      />

      {/* 포그라운드 GPS 보강: 출발 알림 배너 */}
      <DepartureAlert schedules={schedules} />

      {/* 장소 상세 드로어 */}
      {selectedPlace && (
        <PlaceDetailDrawer
          place={selectedPlace}
          onOpenChange={(open) => { if (!open) setSelectedPlace(null); }}
          onEdit={() => setSelectedPlace(null)}
          onDelete={() => setSelectedPlace(null)}
        />
      )}

      {/* 그룹 삭제 확인 다이얼로그 */}
      <AlertDialog
        open={!!groupDeleteTarget}
        onOpenChange={(open) => { if (!open) setGroupDeleteTarget(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>지역 그룹 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{groupDeleteTarget?.title}&rdquo; 그룹에 {groupDeleteTarget?.childCount}개 장소가 있습니다. 어떻게 처리할까요?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              variant="outline"
              onClick={() => handleGroupDeleteChoice("promote")}
            >
              하위 장소 유지
            </AlertDialogAction>
            <AlertDialogAction
              variant="destructive"
              onClick={() => handleGroupDeleteChoice("cascade")}
            >
              모두 삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DndContext>
  );
}

// -----------------------------------------------------------------------
// Helper: resolve drop target schedule ID
// -----------------------------------------------------------------------
function resolveDropScheduleId(
  overId: string,
  schedules: Schedule[]
): string | null {
  if (overId.startsWith("schedule-")) {
    return overId.replace("schedule-", "");
  }
  if (overId.startsWith("group-")) {
    for (const s of schedules) {
      const groupId = overId.replace("group-", "");
      if ((s.items ?? []).some((i) => i.id === groupId)) {
        return s.id;
      }
    }
    return null;
  }
  for (const s of schedules) {
    if ((s.items ?? []).some((i) => i.id === overId)) {
      return s.id;
    }
  }
  return null;
}

// -----------------------------------------------------------------------
// Sub-component: Route View
// -----------------------------------------------------------------------
function RouteView({
  schedules,
  routeDateIndex,
  onDateChange,
}: {
  schedules: Schedule[];
  routeDateIndex: number;
  onDateChange: (idx: number) => void;
}) {
  const currentItems = useMemo(
    () => schedules[routeDateIndex]?.items ?? [],
    [schedules, routeDateIndex]
  );

  const geoItems = useMemo(
    () => currentItems.filter((item) => item.place?.latitude && item.place?.longitude),
    [currentItems]
  );

  return (
    <div className="space-y-3">
      {schedules.length > 1 && (
        <div className="flex gap-1.5 flex-wrap">
          {schedules.map((schedule, idx) => (
            <button
              key={schedule.id}
              type="button"
              onClick={() => onDateChange(idx)}
              className={cn(
                "rounded-lg border px-3 py-1 text-xs font-medium transition-colors",
                routeDateIndex === idx
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card hover:bg-muted"
              )}
            >
              {`Day ${idx + 1}`}
              <span className="ml-1 text-[10px] opacity-70">
                {formatDateShort(schedule.date)}
              </span>
            </button>
          ))}
        </div>
      )}

      <RouteMap
        scheduleItems={currentItems}
        className="h-[520px]"
      />

      {geoItems.length > 0 && (
        <ol className="space-y-1 text-sm text-muted-foreground pl-1">
          {geoItems.map((item, idx) => (
              <li key={item.id} className="flex items-center gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                  {idx + 1}
                </span>
                <span>{item.title}</span>
                {item.arrival_by && (
                  <span className="text-xs opacity-60">
                    {new Date(item.arrival_by).toLocaleTimeString("ko-KR", {
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: false,
                    })}까지
                  </span>
                )}
              </li>
            ))}
        </ol>
      )}
    </div>
  );
}
