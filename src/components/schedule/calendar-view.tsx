"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { ko } from "date-fns/locale";
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
  type DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { DraggableItem } from "./draggable-item";
import type { Schedule, ScheduleItem, Place } from "@/types/database";

// -----------------------------------------------------------------------
// Transport badge between items
// -----------------------------------------------------------------------
function TransportBadge({ transport }: { transport: string }) {
  return (
    <div className="flex items-center gap-2 py-1 pl-8">
      <Separator className="flex-1" />
      <Badge variant="secondary" className="text-xs font-normal">
        {transport}
      </Badge>
      <Separator className="flex-1" />
    </div>
  );
}

// -----------------------------------------------------------------------
// Droppable Day card
// -----------------------------------------------------------------------
interface DayCardProps {
  schedule: Schedule;
  dayIndex: number;
  onAddItem: (scheduleId: string) => void;
  onEditItem: (item: ScheduleItem) => void;
  onDeleteItem: (itemId: string, scheduleId: string) => void;
}

function DayCard({
  schedule,
  dayIndex,
  onAddItem,
  onEditItem,
  onDeleteItem,
}: DayCardProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `schedule-${schedule.id}`,
    data: { type: "schedule", scheduleId: schedule.id },
  });

  const items = schedule.items ?? [];
  const dateObj = parseISO(schedule.date);
  const dateLabel = format(dateObj, "M/d EEE", { locale: ko });

  return (
    <div className="space-y-2">
      {/* Day header */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-foreground">
            Day {dayIndex + 1}
          </span>
          <span className="text-sm text-muted-foreground">({dateLabel})</span>
        </div>
        {schedule.day_memo && (
          <span className="text-xs text-muted-foreground truncate">
            — {schedule.day_memo}
          </span>
        )}
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={cn(
          "rounded-xl border-2 border-dashed p-3 min-h-[80px] transition-colors space-y-1",
          isOver
            ? "border-primary bg-primary/5"
            : items.length === 0
            ? "border-muted-foreground/20"
            : "border-transparent"
        )}
      >
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-4 gap-2">
            <p className="text-xs text-muted-foreground">
              일정이 없습니다. 장소를 드래그하거나 추가하세요.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => onAddItem(schedule.id)}
            >
              <Plus className="w-3 h-3 mr-1" />
              일정 추가
            </Button>
          </div>
        ) : (
          <SortableContext
            items={items.map((i) => i.id)}
            strategy={verticalListSortingStrategy}
          >
            {items.map((item, idx) => (
              <div key={item.id}>
                <DraggableItem
                  item={item}
                  onEdit={onEditItem}
                  onDelete={(id) => onDeleteItem(id, schedule.id)}
                />
                {item.transport_to_next && idx < items.length - 1 && (
                  <TransportBadge transport={item.transport_to_next} />
                )}
              </div>
            ))}
          </SortableContext>
        )}
      </div>

      {/* Add button (always visible at bottom when items exist) */}
      {items.length > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-muted-foreground"
          onClick={() => onAddItem(schedule.id)}
        >
          <Plus className="w-3 h-3 mr-1" />
          일정 추가
        </Button>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------
// cn helper (inline to avoid extra import complexity)
// -----------------------------------------------------------------------
function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

// -----------------------------------------------------------------------
// Calendar View
// -----------------------------------------------------------------------
interface CalendarViewProps {
  schedules: Schedule[];
  onAddItem: (scheduleId: string) => void;
  onEditItem: (item: ScheduleItem) => void;
  onDeleteItem: (itemId: string, scheduleId: string) => void;
  onReorderItems: (
    scheduleId: string,
    orderedItems: ScheduleItem[]
  ) => Promise<void>;
  onDropPlace: (
    scheduleId: string,
    place: Place,
    sortOrder: number
  ) => Promise<void>;
}

export function CalendarView({
  schedules,
  onAddItem,
  onEditItem,
  onDeleteItem,
  onReorderItems,
  onDropPlace,
}: CalendarViewProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
    })
  );

  // Find active item across all schedules
  const activeItem = schedules
    .flatMap((s) => s.items ?? [])
    .find((i) => i.id === activeId);

  const handleDragStart = (event: DragStartEvent) => {
    const id = event.active.id as string;
    // Only set activeId for schedule items (not places)
    if (!id.startsWith("place-")) {
      setActiveId(id);
    }
  };

  const handleDragOver = (_event: DragOverEvent) => {
    // Visual feedback handled by useDroppable isOver
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Case 1: Dragging a place card from sidebar → drop on a schedule zone
    if (activeId.startsWith("place-")) {
      const place = active.data.current?.place as Place | undefined;
      if (!place) return;

      let targetScheduleId: string | null = null;

      if (overId.startsWith("schedule-")) {
        targetScheduleId = overId.replace("schedule-", "");
      } else {
        // Dropped on an item — find which schedule contains it
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
      await onDropPlace(targetScheduleId, place, sortOrder);
      return;
    }

    // Case 2: Reordering items within or across schedules
    // Find source schedule
    let sourceSchedule: Schedule | undefined;
    for (const s of schedules) {
      if ((s.items ?? []).some((i) => i.id === activeId)) {
        sourceSchedule = s;
        break;
      }
    }
    if (!sourceSchedule) return;

    // Find target schedule
    let targetScheduleId: string | null = null;
    if (overId.startsWith("schedule-")) {
      targetScheduleId = overId.replace("schedule-", "");
    } else {
      for (const s of schedules) {
        if ((s.items ?? []).some((i) => i.id === overId)) {
          targetScheduleId = s.id;
          break;
        }
      }
    }

    if (!targetScheduleId) return;

    // Same schedule reorder
    if (sourceSchedule.id === targetScheduleId) {
      const items = sourceSchedule.items ?? [];
      const oldIndex = items.findIndex((i) => i.id === activeId);
      const newIndex = items.findIndex((i) => i.id === overId);
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;
      const reordered = arrayMove(items, oldIndex, newIndex).map(
        (item, idx) => ({ ...item, sort_order: idx + 1 })
      );
      await onReorderItems(sourceSchedule.id, reordered);
    }
    // Cross-schedule move: not required by spec but could be added later
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-8">
        {schedules.map((schedule, idx) => (
          <DayCard
            key={schedule.id}
            schedule={schedule}
            dayIndex={idx}
            onAddItem={onAddItem}
            onEditItem={onEditItem}
            onDeleteItem={onDeleteItem}
          />
        ))}
      </div>

      {/* Drag overlay for item dragging */}
      <DragOverlay>
        {activeItem && (
          <div className="opacity-90 pointer-events-none w-72">
            <DraggableItem
              item={activeItem}
              onEdit={() => {}}
              onDelete={() => {}}
            />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
