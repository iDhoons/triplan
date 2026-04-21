"use client";

import { memo } from "react";
import type { DraggableAttributes, DraggableSyntheticListeners } from "@dnd-kit/core";
import { GripVertical, FileText, Pencil, Trash2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ScheduleItem } from "@/types/database";

interface DraggableItemProps {
  item: ScheduleItem;
  orderNumber: number;
  onEdit: (item: ScheduleItem) => void;
  onDelete: (itemId: string) => void;
  onPlaceClick?: (place: NonNullable<ScheduleItem["place"]>) => void;
  isDragging?: boolean;
  dragHandleProps?: {
    attributes: DraggableAttributes;
    listeners: DraggableSyntheticListeners;
  };
}

export const DraggableItem = memo(function DraggableItem({
  item,
  orderNumber,
  onEdit,
  onDelete,
  onPlaceClick,
  isDragging = false,
  dragHandleProps,
}: DraggableItemProps) {

  const formatArrivalBy = (arrivalBy: string | null) => {
    if (!arrivalBy) return null;
    try {
      const date = new Date(arrivalBy);
      return date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });
    } catch {
      return null;
    }
  };

  // "HH:MM:SS" → "HH:MM"
  const formatStartTime = (startTime: string | null) => {
    if (!startTime) return null;
    return startTime.slice(0, 5);
  };

  const arrivalTime = formatArrivalBy(item.arrival_by);
  const startTimeDisplay = formatStartTime(item.start_time);

  return (
    <div
      className={cn(
        "group relative bg-card border rounded-lg p-3 flex gap-2.5 items-start",
        "hover:border-primary/50 transition-colors",
        isDragging && "opacity-50 shadow-lg border-primary"
      )}
    >
      {/* Order number badge + drag handle (grip icon) */}
      <div
        {...dragHandleProps?.attributes}
        {...dragHandleProps?.listeners}
        className="flex flex-col items-center gap-1 shrink-0 cursor-grab active:cursor-grabbing touch-none"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
          {orderNumber}
        </span>
        <GripVertical className="w-4 h-4 text-muted-foreground/40" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="font-medium text-sm leading-snug truncate">{item.title}</p>

          {/* Action buttons - visible on hover */}
          <div
            className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onEdit(item)}
              aria-label="수정"
            >
              <Pencil className="w-3 h-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-destructive hover:text-destructive"
              onClick={() => onDelete(item.id)}
              aria-label="삭제"
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        </div>

        {/* Start time */}
        {startTimeDisplay && (
          <div className="flex items-center gap-1 mt-1 text-xs text-primary/80 font-medium">
            <Clock className="w-3 h-3" />
            <span>{startTimeDisplay} 출발</span>
          </div>
        )}

        {/* Arrival by time */}
        {arrivalTime && (
          <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" />
            <span>{arrivalTime}까지 도착</span>
          </div>
        )}

        {/* Memo */}
        {item.memo && (
          <div className="flex items-start gap-1 mt-1 text-xs text-muted-foreground">
            <FileText className="w-3 h-3 mt-0.5 shrink-0" />
            <span className="line-clamp-2">{item.memo}</span>
          </div>
        )}

        {/* Place name */}
        {item.place && (
          <Badge
            variant="secondary"
            className={cn(
              "mt-1.5 text-xs h-5",
              onPlaceClick && "cursor-pointer hover:bg-primary/20 transition-colors"
            )}
            onClick={onPlaceClick ? (e) => {
              e.stopPropagation();
              onPlaceClick(item.place!);
            } : undefined}
          >
            {item.place.name}
          </Badge>
        )}
      </div>
    </div>
  );
});
