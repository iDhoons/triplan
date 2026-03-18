"use client";

import { format, parseISO } from "date-fns";
import { ko } from "date-fns/locale";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useDroppable } from "@dnd-kit/core";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DraggableItem } from "./draggable-item";
import { TravelInfoCard } from "./travel-info-card";
import { WeatherBadge } from "./weather-badge";
import type { Schedule, ScheduleItem } from "@/types/database";
import type { InsertIndicator } from "@/app/(main)/trips/[tripId]/schedule/page";

// -----------------------------------------------------------------------
// Insertion line — 드래그 중 삽입 위치를 보여주는 파란 라인
// -----------------------------------------------------------------------
function InsertionLine() {
  return (
    <div className="relative flex items-center py-1" aria-hidden>
      <div className="absolute left-0 h-1.5 w-1.5 rounded-full bg-primary -translate-x-0.5" />
      <div className="flex-1 h-0.5 bg-primary rounded-full" />
      <div className="absolute right-0 h-1.5 w-1.5 rounded-full bg-primary translate-x-0.5" />
    </div>
  );
}

// -----------------------------------------------------------------------
// Sortable wrapper — useSortable을 wrapper 레벨에 적용하여
// DraggableItem + TravelInfoCard가 함께 밀리도록 함
// -----------------------------------------------------------------------
function SortableItemWrapper({
  item,
  orderNumber,
  nextItem,
  isLast,
  onEdit,
  onDelete,
}: {
  item: ScheduleItem;
  orderNumber: number;
  nextItem?: ScheduleItem;
  isLast: boolean;
  onEdit: (item: ScheduleItem) => void;
  onDelete: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className={isDragging ? "relative z-50" : "relative"}>
      <DraggableItem
        item={item}
        orderNumber={orderNumber}
        onEdit={onEdit}
        onDelete={onDelete}
        isDragging={isDragging}
        dragHandleProps={{ attributes, listeners }}
      />
      {!isLast && nextItem && (
        <TravelInfoCard currentItem={item} nextItem={nextItem} />
      )}
    </div>
  );
}

// -----------------------------------------------------------------------
// Droppable Day card — 순서 기반 플래너
// -----------------------------------------------------------------------
interface DayCardProps {
  schedule: Schedule;
  dayIndex: number;
  insertIndex?: number;
  onAddItem: (scheduleId: string) => void;
  onEditItem: (item: ScheduleItem) => void;
  onDeleteItem: (itemId: string, scheduleId: string) => void;
}

function DayCard({
  schedule,
  dayIndex,
  insertIndex,
  onAddItem,
  onEditItem,
  onDeleteItem,
}: DayCardProps) {
  const isInsertTarget = insertIndex !== undefined;
  const { setNodeRef, isOver } = useDroppable({
    id: `schedule-${schedule.id}`,
    data: { type: "schedule", scheduleId: schedule.id },
  });

  const items = schedule.items ?? [];
  const dateObj = parseISO(schedule.date);
  const dateLabel = format(dateObj, "M/d EEE", { locale: ko });

  return (
    <div ref={setNodeRef} className="space-y-2">
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

      {/* Drop zone — visual feedback only here */}
      <div
        className={cn(
          "rounded-xl border-2 border-dashed p-3 min-h-[80px] transition-colors",
          isOver || isInsertTarget
            ? "border-primary bg-primary/5"
            : items.length === 0
            ? "border-muted-foreground/20"
            : "border-transparent"
        )}
      >
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-4 gap-2">
            {isInsertTarget ? (
              <InsertionLine />
            ) : (
              <>
                <p className="text-xs text-muted-foreground">
                  일정이 없습니다. 장소를 드래그하거나 추가하세요.
                </p>
                <Button
                  variant="outline"
                  size="xs"
                  onClick={() => onAddItem(schedule.id)}
                >
                  <Plus className="w-3 h-3 mr-1" />
                  일정 추가
                </Button>
              </>
            )}
          </div>
        ) : (
          <SortableContext
            items={items.map((i) => i.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-0">
              {/* 맨 위 삽입 라인 */}
              {insertIndex === 0 && <InsertionLine />}
              {items.map((item, idx) => (
                <div key={item.id}>
                  <SortableItemWrapper
                    item={item}
                    orderNumber={idx + 1}
                    nextItem={idx < items.length - 1 ? items[idx + 1] : undefined}
                    isLast={idx === items.length - 1}
                    onEdit={onEditItem}
                    onDelete={(id) => onDeleteItem(id, schedule.id)}
                  />
                  {/* 이 아이템 뒤에 삽입 라인 */}
                  {insertIndex === idx + 1 && <InsertionLine />}
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
          size="xs"
          className="text-muted-foreground"
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
  insertIndicator: InsertIndicator | null;
  onAddItem: (scheduleId: string) => void;
  onEditItem: (item: ScheduleItem) => void;
  onDeleteItem: (itemId: string, scheduleId: string) => void;
}

export function PlannerView({
  schedules,
  insertIndicator,
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
          insertIndex={
            insertIndicator?.scheduleId === schedule.id
              ? insertIndicator.insertIndex
              : undefined
          }
          onAddItem={onAddItem}
          onEditItem={onEditItem}
          onDeleteItem={onDeleteItem}
        />
      ))}
    </div>
  );
}
