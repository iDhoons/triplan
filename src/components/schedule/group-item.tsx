import type { DraggableAttributes, DraggableSyntheticListeners } from "@dnd-kit/core";
import { MapPin, ChevronRight, GripVertical, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ScheduleItem } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface GroupItemProps {
  item: ScheduleItem;
  orderNumber: number;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit?: (item: ScheduleItem) => void;
  onDelete: (itemId: string) => void;
  dragHandleProps?: {
    attributes: DraggableAttributes;
    listeners: DraggableSyntheticListeners;
  };
  children: React.ReactNode;
}

export function GroupItem({
  item,
  isExpanded,
  onToggle,
  onEdit,
  onDelete,
  dragHandleProps,
  children,
}: GroupItemProps) {
  const childCount = item.children?.length ?? 0;

  return (
    <div className="group relative">
      <div
        className={cn(
          "relative flex items-center gap-3 rounded-lg bg-muted/40 p-3",
          "border-l-4 border-l-primary/30",
          "hover:bg-muted/60 transition-colors cursor-pointer"
        )}
        onClick={onToggle}
      >
        {/* Drag handle */}
        <div
          {...dragHandleProps?.attributes}
          {...dragHandleProps?.listeners}
          className="flex items-center shrink-0 cursor-grab active:cursor-grabbing touch-none"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="w-4 h-4 text-muted-foreground/40" />
        </div>

        <MapPin className="h-4 w-4 text-primary shrink-0" />

        <span className="flex-1 font-medium text-sm text-foreground truncate">
          {item.title}
        </span>

        <Badge variant="secondary" className="text-xs h-5 shrink-0">
          {childCount}개 장소
        </Badge>

        <ChevronRight
          className={cn(
            "h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200",
            isExpanded && "rotate-90"
          )}
        />

        <div
          className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
          onPointerDown={(e) => e.stopPropagation()}
        >
          {onEdit && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(item);
              }}
              aria-label="수정"
            >
              <Pencil className="w-3 h-3" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-destructive hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(item.id);
            }}
            aria-label="삭제"
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {isExpanded && (
        <div className="ml-6 mt-2 space-y-2 pl-4">
          {children}
        </div>
      )}
    </div>
  );
}
