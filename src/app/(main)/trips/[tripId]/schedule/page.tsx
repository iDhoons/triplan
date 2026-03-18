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
  type Modifier,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { ListOrdered, RouteIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { PlannerView } from "@/components/schedule/planner-view";
import { PlaceSidebar } from "@/components/schedule/place-sidebar";
import {
  ScheduleItemForm,
} from "@/components/schedule/schedule-item-form";
import { DayPickerSheet } from "@/components/schedule/day-picker-sheet";
import { UnscheduledFAB } from "@/components/schedule/unscheduled-fab";
import { RouteMap } from "@/components/maps/route-map";
import { useScheduleData } from "@/hooks/use-schedule-data";
import { useScheduleActions } from "@/hooks/use-schedule-actions";
import type { Schedule, ScheduleItem, Place } from "@/types/database";

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------

/** 포인터/터치 이벤트에서 좌표 추출 */
function getPointerCoords(event: Event): { x: number; y: number } | null {
  if ("clientX" in event) {
    return { x: (event as MouseEvent).clientX, y: (event as MouseEvent).clientY };
  }
  if ("touches" in event) {
    const touch = (event as TouchEvent).touches[0];
    if (touch) return { x: touch.clientX, y: touch.clientY };
  }
  return null;
}

/**
 * DragOverlay 중심을 커서 위치에 맞추는 modifier.
 * PlaceCard(원본)와 DragOverlay(작은 프리뷰)의 크기 차이로 인한
 * 오버레이 위치 오프셋 문제를 해결한다.
 */
const snapCenterToCursor: Modifier = ({
  activatorEvent,
  draggingNodeRect,
  transform,
}) => {
  if (!draggingNodeRect || !activatorEvent) return transform;

  const coords = getPointerCoords(activatorEvent);
  if (!coords) return transform;

  const offsetX =
    coords.x - draggingNodeRect.left - draggingNodeRect.width / 2;
  const offsetY =
    coords.y - draggingNodeRect.top - draggingNodeRect.height / 2;

  return {
    ...transform,
    x: transform.x + offsetX,
    y: transform.y + offsetY,
  };
};

const OVERLAY_MODIFIERS: Modifier[] = [snapCenterToCursor];

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
  const [routeDateIndex, setRouteDateIndex] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [targetScheduleId, setTargetScheduleId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<ScheduleItem | null>(null);
  const [activePlaceId, setActivePlaceId] = useState<string | null>(null);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);

  // --- DayPickerSheet state ---
  const [dayPickerOpen, setDayPickerOpen] = useState(false);
  const [dayPickerPlace, setDayPickerPlace] = useState<Place | null>(null);
  const dayPickerTriggerRef = useRef<HTMLElement | null>(null);

  // --- Actions (React Query invalidation) ---
  const {
    handleFormSubmit,
    handleDeleteItem,
    handleReorderItems,
    handleDropPlace,
  } = useScheduleActions({
    tripId,
    supabase,
    schedules,
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
      await handleDropPlace(scheduleId, place, sortOrder);
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

  // --- DnD ---
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
  );

  // 장소 드래그 여부를 ref로 추적 (collision callback 안에서 즉시 읽기 위해)
  const isDraggingPlaceRef = useRef(false);

  const collisionDetection: CollisionDetection = useCallback(
    (args) => {
      // 장소 카드 드래그: 포인터가 드롭존 안에 있을 때만 반응
      // → closestCenter 폴백 제거하여 먼 거리의 드롭존이 잡히지 않도록
      if (isDraggingPlaceRef.current) {
        return pointerWithin(args);
      }
      // 일정 아이템 재정렬: closestCenter로 부드러운 정렬
      const pointerCollisions = pointerWithin(args);
      if (pointerCollisions.length > 0) return pointerCollisions;
      return closestCenter(args);
    },
    []
  );

  const handleTopDragStart = (event: DragStartEvent) => {
    const id = event.active.id as string;
    if (id.startsWith("place-")) {
      setActivePlaceId(id);
      isDraggingPlaceRef.current = true;
    } else {
      setActiveItemId(id);
      isDraggingPlaceRef.current = false;
    }
  };

  const handleTopDragEnd = async (event: DragEndEvent) => {
    setActivePlaceId(null);
    setActiveItemId(null);
    isDraggingPlaceRef.current = false;
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Case 1: 장소 카드를 일정에 드롭
    if (activeId.startsWith("place-")) {
      const place = active.data.current?.place as Place | undefined;
      if (!place) return;

      let dropScheduleId = resolveDropScheduleId(overId, schedules);
      if (!dropScheduleId) return;
      const targetSchedule = schedules.find((s) => s.id === dropScheduleId);
      const sortOrder = (targetSchedule?.items?.length ?? 0) + 1;
      await handleDropPlace(dropScheduleId, place, sortOrder);
      return;
    }

    // Case 2: 일정 아이템 재정렬
    let sourceSchedule: Schedule | undefined;
    for (const s of schedules) {
      if ((s.items ?? []).some((i) => i.id === activeId)) {
        sourceSchedule = s;
        break;
      }
    }
    if (!sourceSchedule) return;

    const dropScheduleId = resolveDropScheduleId(overId, schedules);
    if (!dropScheduleId || sourceSchedule.id !== dropScheduleId) return;

    const items = sourceSchedule.items ?? [];
    const oldIndex = items.findIndex((i) => i.id === activeId);
    const newIndex = items.findIndex((i) => i.id === overId);
    if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;

    const reordered = arrayMove(items, oldIndex, newIndex).map(
      (item, idx) => ({ ...item, sort_order: idx + 1 })
    );
    await handleReorderItems(sourceSchedule.id, reordered);
  };

  const activePlaceObj = activePlaceId
    ? places.find((p) => `place-${p.id}` === activePlaceId) ?? null
    : null;

  const activeItemObj = activeItemId
    ? schedules.flatMap((s) => s.items ?? []).find((i) => i.id === activeItemId) ?? null
    : null;

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
                onAddItem={handleOpenAddForm}
                onEditItem={handleOpenEditForm}
                onDeleteItem={handleDeleteItem}
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
              "md:w-56 md:min-h-[500px]",
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
        dropAnimation={{ duration: 200, easing: "ease" }}
      >
        {activePlaceObj && (
          <div className="pointer-events-none w-40 bg-card border rounded-lg p-2 shadow-xl text-xs font-medium scale-105">
            {activePlaceObj.name}
          </div>
        )}
        {activeItemObj && (
          <div className="pointer-events-none bg-card border border-primary rounded-lg p-3 shadow-xl max-w-sm scale-[1.02]">
            <p className="font-medium text-sm">{activeItemObj.title}</p>
            {activeItemObj.place && (
              <span className="text-xs text-muted-foreground">{activeItemObj.place.name}</span>
            )}
          </div>
        )}
      </DragOverlay>

      {/* Item add/edit form */}
      <ScheduleItemForm
        open={formOpen}
        onOpenChange={setFormOpen}
        editingItem={editingItem}
        places={places}
        onSubmit={handleFormSubmit}
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
        scheduleItems={schedules[routeDateIndex]?.items ?? []}
        className="h-[520px]"
      />

      {(schedules[routeDateIndex]?.items ?? []).filter(
        (item) => item.place?.latitude && item.place?.longitude
      ).length > 0 && (
        <ol className="space-y-1 text-sm text-muted-foreground pl-1">
          {(schedules[routeDateIndex]?.items ?? [])
            .filter((item) => item.place?.latitude && item.place?.longitude)
            .map((item, idx) => (
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
