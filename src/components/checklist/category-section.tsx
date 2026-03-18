"use client";

import { useState } from "react";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { ChevronDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { CATEGORY_MAP, sortItems, type SortMode } from "./constants";
import { ChecklistItem } from "./checklist-item";
import { InlineAddInput } from "./inline-add-input";
import type {
  ChecklistItem as ChecklistItemType,
  ChecklistCategory,
  MemberRole,
} from "@/types/database";

interface CategorySectionProps {
  category: ChecklistCategory;
  items: ChecklistItemType[];
  sortMode: SortMode;
  userRole: MemberRole;
  onToggle: (id: string, checked: boolean) => void;
  onEdit: (item: ChecklistItemType) => void;
  onDelete: (id: string) => void;
  onShowHistory: (itemId: string) => void;
  onAdd?: (title: string, category: ChecklistCategory) => void;
}

export function CategorySection({
  category,
  items,
  sortMode,
  userRole,
  onToggle,
  onEdit,
  onDelete,
  onShowHistory,
  onAdd,
}: CategorySectionProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [showInlineAdd, setShowInlineAdd] = useState(false);
  const meta = CATEGORY_MAP[category];
  const Icon = meta.icon;
  const checked = items.filter((i) => i.is_checked).length;
  const sorted = sortItems(items, sortMode);
  const canAdd = !!onAdd;

  if (items.length === 0 && !canAdd) return null;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 w-full py-1.5 px-1">
        <button
          className="flex items-center gap-2 flex-1 text-left"
          onClick={() => setCollapsed((v) => !v)}
        >
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium flex-1">{meta.label}</span>
          {items.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {checked}/{items.length}
            </span>
          )}
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform",
              collapsed && "-rotate-90"
            )}
          />
        </button>
        {canAdd && !collapsed && (
          <button
            className="p-0.5 rounded hover:bg-muted transition-colors"
            onClick={() => setShowInlineAdd(true)}
            aria-label={`${meta.label}에 항목 추가`}
          >
            <Plus className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {!collapsed && (
        <>
          {items.length > 0 && (
            <SortableContext
              items={sorted.map((i) => i.id)}
              strategy={verticalListSortingStrategy}
              disabled={sortMode !== "manual"}
            >
              <div className="space-y-1 pl-1">
                {sorted.map((item) => (
                  <ChecklistItem
                    key={item.id}
                    item={item}
                    sortMode={sortMode}
                    userRole={userRole}
                    onToggle={(checked) => onToggle(item.id, checked)}
                    onEdit={() => onEdit(item)}
                    onDelete={() => onDelete(item.id)}
                    onShowHistory={() => onShowHistory(item.id)}
                  />
                ))}
              </div>
            </SortableContext>
          )}
          {showInlineAdd && canAdd && (
            <div className="pl-1">
              <InlineAddInput
                placeholder={`${meta.label} 항목 추가...`}
                onAdd={(title) => onAdd(title, category)}
                onCancel={() => setShowInlineAdd(false)}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
