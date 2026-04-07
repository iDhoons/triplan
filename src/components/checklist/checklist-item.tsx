"use client";

import { memo } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil, Trash2, History, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { PRIORITY_CONFIG, type SortMode } from "./constants";
import type { ChecklistItem as ChecklistItemType, MemberRole } from "@/types/database";

interface ChecklistItemProps {
  item: ChecklistItemType;
  sortMode: SortMode;
  userRole: MemberRole;
  onToggle: (checked: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
  onShowHistory: () => void;
}

export const ChecklistItem = memo(function ChecklistItem({
  item,
  sortMode,
  userRole,
  onToggle,
  onEdit,
  onDelete,
  onShowHistory,
}: ChecklistItemProps) {
  const canEdit = userRole === "admin" || userRole === "editor";
  const showDragHandle = sortMode === "manual" && canEdit;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id, disabled: !showDragHandle });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  const priorityCfg = PRIORITY_CONFIG[item.priority];

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-lg border bg-card transition-colors",
        isDragging && "opacity-50 shadow-lg",
        item.is_checked && "opacity-60"
      )}
    >
      {showDragHandle && (
        <button
          className="cursor-grab touch-none text-muted-foreground hover:text-foreground"
          aria-label={`${item.title} 순서 변경`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" aria-hidden="true" />
        </button>
      )}

      <button
        className="flex-shrink-0"
        onClick={() => onToggle(!item.is_checked)}
        aria-label={item.is_checked ? "체크 해제" : "체크"}
      >
        <div
          className={cn(
            "h-5 w-5 rounded border-2 flex items-center justify-center transition-colors",
            item.is_checked
              ? "bg-primary border-primary text-primary-foreground"
              : "border-muted-foreground/40"
          )}
        >
          {item.is_checked && (
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
      </button>

      <div className="flex-1 min-w-0">
        <span
          className={cn(
            "text-sm block truncate",
            item.is_checked && "line-through text-muted-foreground"
          )}
        >
          {item.title}
        </span>
        {item.memo && (
          <span className="text-xs text-muted-foreground block truncate">
            {item.memo}
          </span>
        )}
      </div>

      {item.priority === "high" && (
        <Badge variant="secondary" className={cn("text-[10px] px-1.5 py-0", priorityCfg.className)}>
          긴급
        </Badge>
      )}

      {item.assignee && (
        <Avatar className="h-5 w-5">
          <AvatarImage src={item.assignee.avatar_url ?? undefined} />
          <AvatarFallback className="text-[9px]">
            {item.assignee.display_name?.[0]}
          </AvatarFallback>
        </Avatar>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 flex-shrink-0"
              aria-label="더보기"
            />
          }
        >
          <MoreVertical className="h-3.5 w-3.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-36">
          <DropdownMenuItem onClick={onShowHistory}>
            <History className="h-3.5 w-3.5 mr-2" />
            이력 보기
          </DropdownMenuItem>
          {canEdit && (
            <>
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="h-3.5 w-3.5 mr-2" />
                수정
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onDelete}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5 mr-2" />
                삭제
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
});
