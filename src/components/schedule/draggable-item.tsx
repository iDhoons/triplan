"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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
}

export function DraggableItem({ item, orderNumber, onEdit, onDelete }: DraggableItemProps) {
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

  const formatArrivalBy = (arrivalBy: string | null) => {
    if (!arrivalBy) return null;
    try {
      const date = new Date(arrivalBy);
      return date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });
    } catch {
      return null;
    }
  };

  const arrivalTime = formatArrivalBy(item.arrival_by);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative bg-card border rounded-lg p-3 flex gap-2.5 items-start",
        "hover:border-primary/50 transition-colors",
        isDragging && "opacity-50 shadow-lg z-50 border-primary"
      )}
    >
      {/* Order number badge */}
      <div className="flex flex-col items-center gap-1 shrink-0">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
          {orderNumber}
        </span>
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="text-muted-foreground/40 hover:text-muted-foreground cursor-grab active:cursor-grabbing touch-none"
          aria-label="드래그 핸들"
        >
          <GripVertical className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="font-medium text-sm leading-snug truncate">{item.title}</p>

          {/* Action buttons - visible on hover */}
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => onEdit(item)}
              aria-label="수정"
            >
              <Pencil className="w-3 h-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-destructive hover:text-destructive"
              onClick={() => onDelete(item.id)}
              aria-label="삭제"
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        </div>

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
          <Badge variant="secondary" className="mt-1.5 text-xs h-5">
            {item.place.name}
          </Badge>
        )}
      </div>
    </div>
  );
}
