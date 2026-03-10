"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Clock, FileText, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ScheduleItem } from "@/types/database";

interface DraggableItemProps {
  item: ScheduleItem;
  onEdit: (item: ScheduleItem) => void;
  onDelete: (itemId: string) => void;
}

export function DraggableItem({ item, onEdit, onDelete }: DraggableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const formatTime = (time: string | null) => {
    if (!time) return null;
    return time.slice(0, 5);
  };

  const startTime = formatTime(item.start_time);
  const endTime = formatTime(item.end_time);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative bg-card border rounded-lg p-3 flex gap-2 items-start",
        "hover:border-primary/50 transition-colors",
        isDragging && "opacity-50 shadow-lg z-50 border-primary"
      )}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="mt-0.5 text-muted-foreground/40 hover:text-muted-foreground cursor-grab active:cursor-grabbing touch-none"
        aria-label="드래그 핸들"
      >
        <GripVertical className="w-4 h-4" />
      </button>

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

        {/* Time */}
        {(startTime || endTime) && (
          <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" />
            <span>
              {startTime ?? "--:--"}
              {endTime && ` ~ ${endTime}`}
            </span>
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

      {/* Transport to next - rendered outside the card by parent, but stored in item */}
    </div>
  );
}
