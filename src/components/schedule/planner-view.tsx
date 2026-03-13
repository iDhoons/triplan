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
import { DraggableItem } from "./draggable-item";
import { TravelInfoCard } from "./travel-info-card";
import { WeatherBadge } from "./weather-badge";
import type { Schedule, ScheduleItem } from "@/types/database";

// -----------------------------------------------------------------------
// Droppable Day card — 순서 기반 플래너
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
        <WeatherBadge weather={schedule.weather_summary ?? null} />
        {schedule.day_memo && (
          <span className="text-xs text-muted-foreground truncate">
            — {schedule.day_memo}
          </span>
        )}
        {items.length > 0 && (
          <span className="text-xs text-muted-foreground ml-auto">
            {items.length}개 일정
          </span>
        )}
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={cn(
          "rounded-xl border-2 border-dashed p-3 min-h-[80px] transition-colors",
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
            <div className="space-y-0">
              {items.map((item, idx) => (
                <div key={item.id}>
                  <DraggableItem
                    item={item}
                    orderNumber={idx + 1}
                    onEdit={onEditItem}
                    onDelete={(id) => onDeleteItem(id, schedule.id)}
                  />
                  {/* 이동 정보 카드: 현재 아이템과 다음 아이템 사이 */}
                  {idx < items.length - 1 && (
                    <TravelInfoCard
                      currentItem={item}
                      nextItem={items[idx + 1]}
                    />
                  )}
                </div>
              ))}
            </div>
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
// cn helper
// -----------------------------------------------------------------------
function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

// -----------------------------------------------------------------------
// Planner View (순서 기반 데일리 플래너)
// -----------------------------------------------------------------------
interface PlannerViewProps {
  schedules: Schedule[];
  onAddItem: (scheduleId: string) => void;
  onEditItem: (item: ScheduleItem) => void;
  onDeleteItem: (itemId: string, scheduleId: string) => void;
}

export function PlannerView({
  schedules,
  onAddItem,
  onEditItem,
  onDeleteItem,
}: PlannerViewProps) {
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
