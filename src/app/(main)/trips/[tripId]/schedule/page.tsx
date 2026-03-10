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
  closestCenter,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { CalendarDays, TimerIcon, RouteIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { CalendarView } from "@/components/schedule/calendar-view";
import { TimelineView } from "@/components/schedule/timeline-view";
import { PlaceSidebar } from "@/components/schedule/place-sidebar";
import { ScheduleItemForm } from "@/components/schedule/schedule-item-form";
import { DraggableItem } from "@/components/schedule/draggable-item";
import { RouteMap } from "@/components/maps/route-map";
import type { Schedule, ScheduleItem, Place, Trip } from "@/types/database";

// -----------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------
type ViewMode = "calendar" | "timeline" | "route";

interface ScheduleItemFormData {
  title: string;
  start_time: string;
  end_time: string;
  memo: string;
  transport_to_next: string;
  place_id: string;
}

// -----------------------------------------------------------------------
// Page Component
// -----------------------------------------------------------------------
export default function SchedulePage() {
  const { tripId } = useParams<{ tripId: string }>();
  const supabase = createClient();

  const [viewMode, setViewMode] = useState<ViewMode>("calendar");
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);

  // Route view state: 선택된 날짜 (null = 전체)
  const [routeDateIndex, setRouteDateIndex] = useState<number>(0);

  // Form state
  const [formOpen, setFormOpen] = useState(false);
  const [targetScheduleId, setTargetScheduleId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<ScheduleItem | null>(null);

  // DnD overlay state for place cards
  const [activePlaceId, setActivePlaceId] = useState<string | null>(null);

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
    // Find which schedule this item belongs to
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
      start_time: data.start_time || null,
      end_time: data.end_time || null,
      memo: data.memo.trim() || null,
      transport_to_next: data.transport_to_next || null,
      place_id: data.place_id || null,
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
      await fetchData();
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
      });
      if (error) throw error;
      toast.success(`"${place.name}" 을(를) 일정에 추가했습니다.`);
      await fetchData();
    } catch (err) {
      console.error(err);
      toast.error("장소 추가에 실패했습니다.");
    }
  };

  // -----------------------------------------------------------------------
  // Top-level DnD handlers (for place sidebar drag)
  // -----------------------------------------------------------------------
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  );

  const handleTopDragStart = (event: DragStartEvent) => {
    const id = event.active.id as string;
    if (id.startsWith("place-")) setActivePlaceId(id);
  };

  const handleTopDragEnd = async (event: DragEndEvent) => {
    setActivePlaceId(null);
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    if (activeId.startsWith("place-")) {
      const place = active.data.current?.place as Place | undefined;
      if (!place) return;

      let targetScheduleId: string | null = null;

      if (overId.startsWith("schedule-")) {
        targetScheduleId = overId.replace("schedule-", "");
      } else {
        // dropped on an item
        for (const s of schedules) {
          if ((s.items ?? []).some((i) => i.id === overId)) {
            targetScheduleId = s.id;
            break;
          }
        }
      }

      if (!targetScheduleId) return;
      const targetSchedule = schedules.find((s) => s.id === targetScheduleId);
      const sortOrder = (targetSchedule?.items?.length ?? 0) + 1;
      await handleDropPlace(targetScheduleId, place, sortOrder);
    }
  };

  const activePlaceObj = activePlaceId
    ? places.find((p) => `place-${p.id}` === activePlaceId) ?? null
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
      collisionDetection={closestCenter}
      onDragStart={handleTopDragStart}
      onDragEnd={handleTopDragEnd}
    >
      <div className="space-y-4">
        {/* View mode toggle */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex rounded-lg border p-1 gap-1">
            <Button
              variant={viewMode === "calendar" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 px-3 text-xs gap-1.5"
              onClick={() => setViewMode("calendar")}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              달력
            </Button>
            <Button
              variant={viewMode === "timeline" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 px-3 text-xs gap-1.5"
              onClick={() => setViewMode("timeline")}
            >
              <TimerIcon className="w-3.5 h-3.5" />
              타임라인
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
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                <CalendarDays className="w-10 h-10 opacity-30" />
                <p className="text-sm">아직 일정이 없습니다.</p>
                <p className="text-xs">여행 날짜별 일정을 자동 생성 중...</p>
              </div>
            ) : viewMode === "calendar" ? (
              <CalendarView
                schedules={schedules}
                onAddItem={handleOpenAddForm}
                onEditItem={handleOpenEditForm}
                onDeleteItem={handleDeleteItem}
                onReorderItems={handleReorderItems}
                onDropPlace={handleDropPlace}
              />
            ) : viewMode === "timeline" ? (
              <TimelineView schedules={schedules} />
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
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-500 text-[10px] font-bold text-white">
                            {idx + 1}
                          </span>
                          <span>{item.title}</span>
                          {item.start_time && (
                            <span className="text-xs opacity-60">
                              {item.start_time}
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

      {/* Place drag overlay */}
      <DragOverlay>
        {activePlaceObj && (
          <div className="opacity-80 pointer-events-none w-40 bg-card border rounded-lg p-2 shadow-lg text-xs font-medium">
            {activePlaceObj.name}
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
