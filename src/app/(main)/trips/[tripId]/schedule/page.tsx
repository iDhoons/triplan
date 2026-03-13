"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
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
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { ListOrdered, RouteIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { PlannerView } from "@/components/schedule/planner-view";
import { PlaceSidebar } from "@/components/schedule/place-sidebar";
import {
  ScheduleItemForm,
  type ScheduleItemFormData,
} from "@/components/schedule/schedule-item-form";
import { RouteMap } from "@/components/maps/route-map";
import type { Schedule, ScheduleItem, Place, Trip } from "@/types/database";

// -----------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------
type ViewMode = "planner" | "route";

// -----------------------------------------------------------------------
// Page Component
// -----------------------------------------------------------------------
export default function SchedulePage() {
  const { tripId } = useParams<{ tripId: string }>();
  const supabase = createClient();

  const [viewMode, setViewMode] = useState<ViewMode>("planner");
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);

  // Route view state: 선택된 날짜
  const [routeDateIndex, setRouteDateIndex] = useState<number>(0);

  // Form state
  const [formOpen, setFormOpen] = useState(false);
  const [targetScheduleId, setTargetScheduleId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<ScheduleItem | null>(null);

  // DnD overlay state
  const [activePlaceId, setActivePlaceId] = useState<string | null>(null);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);

  // -----------------------------------------------------------------------
  // Data fetching
  // -----------------------------------------------------------------------
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch trip info (for date range)
      const { data: tripData } = await supabase
        .from("trips")
        .select("*")
        .eq("id", tripId)
        .single();
      if (tripData) setTrip(tripData as Trip);

      // Fetch schedules with items and places
      const { data: schedulesData, error: schedulesError } = await supabase
        .from("schedules")
        .select(
          `
          *,
          items:schedule_items(
            *,
            place:places(*)
          )
        `
        )
        .eq("trip_id", tripId)
        .order("date", { ascending: true });

      if (schedulesError) throw schedulesError;

      if (schedulesData) {
        // Sort items by sort_order within each schedule
        const normalized = (schedulesData as Schedule[]).map((s) => ({
          ...s,
          items: (s.items ?? [])
            .slice()
            .sort((a, b) => a.sort_order - b.sort_order),
        }));
        setSchedules(normalized);
      }

      // Fetch places for sidebar
      const { data: placesData } = await supabase
        .from("places")
        .select("*")
        .eq("trip_id", tripId)
        .order("created_at", { ascending: true });

      if (placesData) setPlaces(placesData as Place[]);
    } catch (err) {
      console.error(err);
      toast.error("데이터를 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }, [tripId, supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // -----------------------------------------------------------------------
  // Computed: scheduled place IDs set
  // -----------------------------------------------------------------------
  const scheduledPlaceIds = useMemo(() => {
    const ids = new Set<string>();
    schedules.forEach((s) =>
      (s.items ?? []).forEach((i) => {
        if (i.place_id) ids.add(i.place_id);
      })
    );
    return ids;
  }, [schedules]);

  // -----------------------------------------------------------------------
  // Handlers: add/edit item form
  // -----------------------------------------------------------------------
  const handleOpenAddForm = (scheduleId: string) => {
    setTargetScheduleId(scheduleId);
    setEditingItem(null);
    setFormOpen(true);
  };

  const handleOpenEditForm = (item: ScheduleItem) => {
    const parentSchedule = schedules.find((s) =>
      (s.items ?? []).some((i) => i.id === item.id)
    );
    setTargetScheduleId(parentSchedule?.id ?? null);
    setEditingItem(item);
    setFormOpen(true);
  };

  const handleFormSubmit = async (data: ScheduleItemFormData) => {
    if (!targetScheduleId) return;

    const payload = {
      schedule_id: targetScheduleId,
      title: data.title.trim(),
      memo: data.memo.trim() || null,
      place_id: data.place_id || null,
      arrival_by: data.arrival_by ? new Date(data.arrival_by).toISOString() : null,
      travel_mode: data.travel_mode || null,
      // 기존 필드는 null로 유지 (하위호환)
      start_time: null,
      end_time: null,
      transport_to_next: null,
    };

    try {
      if (editingItem) {
        const { error } = await supabase
          .from("schedule_items")
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq("id", editingItem.id);
        if (error) throw error;
        toast.success("일정이 수정되었습니다.");
      } else {
        const schedule = schedules.find((s) => s.id === targetScheduleId);
        const sort_order = (schedule?.items?.length ?? 0) + 1;
        const { error } = await supabase.from("schedule_items").insert({
          ...payload,
          sort_order,
        });
        if (error) throw error;
        toast.success("일정이 추가되었습니다.");
      }

      // 이동 정보 자동 계산 (폼 저장 후)
      await fetchData();
      await computeTravelInfoForSchedule(targetScheduleId);
    } catch (err) {
      console.error(err);
      toast.error("저장에 실패했습니다.");
      throw err;
    }
  };

  // -----------------------------------------------------------------------
  // Handler: delete item
  // -----------------------------------------------------------------------
  const handleDeleteItem = async (itemId: string, _scheduleId: string) => {
    const { error } = await supabase
      .from("schedule_items")
      .delete()
      .eq("id", itemId);
    if (error) {
      toast.error("삭제에 실패했습니다.");
      return;
    }
    toast.success("일정이 삭제되었습니다.");
    await fetchData();
  };

  // -----------------------------------------------------------------------
  // Handler: reorder items (update sort_order in DB)
  // -----------------------------------------------------------------------
  const handleReorderItems = async (
    scheduleId: string,
    orderedItems: ScheduleItem[]
  ) => {
    // Optimistic update
    setSchedules((prev) =>
      prev.map((s) =>
        s.id === scheduleId ? { ...s, items: orderedItems } : s
      )
    );

    try {
      await Promise.all(
        orderedItems.map((item) =>
          supabase
            .from("schedule_items")
            .update({ sort_order: item.sort_order, updated_at: new Date().toISOString() })
            .eq("id", item.id)
        )
      );
      // 순서 변경 후 이동 정보 재계산
      await computeTravelInfoForSchedule(scheduleId);
    } catch {
      toast.error("순서 저장에 실패했습니다.");
      await fetchData(); // revert
    }
  };

  // -----------------------------------------------------------------------
  // Handler: drop place from sidebar → create schedule_item
  // -----------------------------------------------------------------------
  const handleDropPlace = async (
    scheduleId: string,
    place: Place,
    sortOrder: number
  ) => {
    try {
      const { error } = await supabase.from("schedule_items").insert({
        schedule_id: scheduleId,
        place_id: place.id,
        title: place.name,
        sort_order: sortOrder,
        start_time: null,
        end_time: null,
        memo: null,
        transport_to_next: null,
        arrival_by: null,
        travel_mode: null,
      });
      if (error) throw error;
      toast.success(`"${place.name}" 을(를) 일정에 추가했습니다.`);
      await fetchData();
      // 장소 추가 후 이동 정보 계산
      await computeTravelInfoForSchedule(scheduleId);
    } catch (err) {
      console.error(err);
      toast.error("장소 추가에 실패했습니다.");
    }
  };

  // -----------------------------------------------------------------------
  // Directions API: 이동 정보 자동 계산
  // -----------------------------------------------------------------------
  const computeTravelInfoForSchedule = async (scheduleId: string) => {
    // 최신 데이터를 refetch
    const { data } = await supabase
      .from("schedules")
      .select(`*, items:schedule_items(*, place:places(*))`)
      .eq("id", scheduleId)
      .single();

    if (!data) return;

    const items = ((data as Schedule).items ?? [])
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order);

    for (let i = 1; i < items.length; i++) {
      const prev = items[i - 1];
      const curr = items[i];

      // 이미 캐싱되어 있으면 스킵
      if (curr.travel_duration_seconds != null) continue;

      // 양쪽 좌표 필요
      if (
        prev.place?.latitude == null || prev.place?.longitude == null ||
        curr.place?.latitude == null || curr.place?.longitude == null
      ) continue;

      const mode = curr.travel_mode || "walking";

      try {
        const res = await fetch(
          `/api/directions?origin=${prev.place.latitude},${prev.place.longitude}&destination=${curr.place.latitude},${curr.place.longitude}&mode=${mode}`
        );
        if (!res.ok) continue;

        const result = await res.json();

        await supabase
          .from("schedule_items")
          .update({
            travel_duration_seconds: result.duration_seconds,
            travel_distance_meters: result.distance_meters,
            travel_mode: mode,
            updated_at: new Date().toISOString(),
          })
          .eq("id", curr.id);
      } catch {
        // 개별 실패는 무시 — 다음 항목 계속 처리
      }
    }

    // UI 갱신
    await fetchData();
  };

  // -----------------------------------------------------------------------
  // Top-level DnD handlers
  // -----------------------------------------------------------------------
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
  );

  const collisionDetection: CollisionDetection = useCallback(
    (args) => {
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
    } else {
      setActiveItemId(id);
    }
  };

  const handleTopDragEnd = async (event: DragEndEvent) => {
    setActivePlaceId(null);
    setActiveItemId(null);
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Case 1: 장소 카드를 일정에 드롭
    if (activeId.startsWith("place-")) {
      const place = active.data.current?.place as Place | undefined;
      if (!place) return;

      let dropScheduleId: string | null = null;

      if (overId.startsWith("schedule-")) {
        dropScheduleId = overId.replace("schedule-", "");
      } else {
        for (const s of schedules) {
          if ((s.items ?? []).some((i) => i.id === overId)) {
            dropScheduleId = s.id;
            break;
          }
        }
      }

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

    let dropScheduleId: string | null = null;
    if (overId.startsWith("schedule-")) {
      dropScheduleId = overId.replace("schedule-", "");
    } else {
      for (const s of schedules) {
        if ((s.items ?? []).some((i) => i.id === overId)) {
          dropScheduleId = s.id;
          break;
        }
      }
    }
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

  // -----------------------------------------------------------------------
  // Loading skeleton
  // -----------------------------------------------------------------------
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

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
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
              size="sm"
              className="h-7 px-3 text-xs gap-1.5"
              onClick={() => setViewMode("planner")}
            >
              <ListOrdered className="w-3.5 h-3.5" />
              플래너
            </Button>
            <Button
              variant={viewMode === "route" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 px-3 text-xs gap-1.5"
              onClick={() => setViewMode("route")}
            >
              <RouteIcon className="w-3.5 h-3.5" />
              동선
            </Button>
          </div>

          <span className="text-xs text-muted-foreground">
            {trip
              ? `${trip.start_date} ~ ${trip.end_date}`
              : ""}
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
                  <p className="font-medium text-foreground/80">아직 일정이 없습니다</p>
                  <p className="text-sm text-muted-foreground">여행 날짜별 일정을 자동 생성 중...</p>
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
              /* 동선 뷰 */
              <div className="space-y-3">
                {/* 날짜 선택 탭 */}
                {schedules.length > 1 && (
                  <div className="flex gap-1.5 flex-wrap">
                    {schedules.map((schedule, idx) => (
                      <button
                        key={schedule.id}
                        type="button"
                        onClick={() => setRouteDateIndex(idx)}
                        className={cn(
                          "rounded-lg border px-3 py-1 text-xs font-medium transition-colors",
                          routeDateIndex === idx
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-card hover:bg-muted"
                        )}
                      >
                        {`Day ${idx + 1}`}
                        <span className="ml-1 text-[10px] opacity-70">
                          {schedule.date}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {/* 선택된 날짜의 동선 지도 */}
                <RouteMap
                  scheduleItems={
                    schedules[routeDateIndex]?.items ?? []
                  }
                  className="h-[520px]"
                />
                {/* 해당 날짜 일정 목록 (순서 확인용) */}
                {(schedules[routeDateIndex]?.items ?? []).filter(
                  (item) => item.place?.latitude && item.place?.longitude
                ).length > 0 && (
                  <ol className="space-y-1 text-sm text-muted-foreground pl-1">
                    {(schedules[routeDateIndex]?.items ?? [])
                      .filter(
                        (item) =>
                          item.place?.latitude && item.place?.longitude
                      )
                      .map((item, idx) => (
                        <li key={item.id} className="flex items-center gap-2">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                            {idx + 1}
                          </span>
                          <span>{item.title}</span>
                          {item.arrival_by && (
                            <span className="text-xs opacity-60">
                              {new Date(item.arrival_by).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false })}까지
                            </span>
                          )}
                        </li>
                      ))}
                  </ol>
                )}
              </div>
            )}
          </div>

          {/* Place sidebar */}
          <aside
            className={cn(
              "shrink-0",
              "md:w-56 md:min-h-[500px]",
              "border rounded-xl p-3"
            )}
          >
            <PlaceSidebar
              places={places}
              scheduledPlaceIds={scheduledPlaceIds}
            />
          </aside>
        </div>
      </div>

      {/* Drag overlay */}
      <DragOverlay dropAnimation={{ duration: 200, easing: "ease" }}>
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
    </DndContext>
  );
}
