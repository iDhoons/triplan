"use client";

import { format, parseISO } from "date-fns";
import { ko } from "date-fns/locale";
import {
  SortableContext,
  verticalListSortingStrategy,
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
}

export function CalendarView({
  schedules,
  onAddItem,
  onEditItem,
  onDeleteItem,
}: CalendarViewProps) {
  return (
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
  );
}
