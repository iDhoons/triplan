"use client";

import { useState, useMemo, useCallback } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { toast } from "sonner";
import { Plus, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useChecklistItems,
  useChecklistMutations,
} from "@/hooks/use-checklist";
import { useTripMembers } from "@/hooks/use-trip-members";
import { CHECKLIST_CATEGORIES, type SortMode } from "./constants";
import { SortToggle } from "./sort-toggle";
import { CategorySection } from "./category-section";
import { AddItemForm } from "./add-item-form";
import { EditItemSheet } from "./edit-item-sheet";
import { ItemHistory } from "./item-history";
import type {
  ChecklistItem,
  ChecklistCategory,
  MemberRole,
} from "@/types/database";

interface ChecklistPageProps {
  tripId: string;
  userRole: MemberRole;
}

export function ChecklistPage({ tripId, userRole }: ChecklistPageProps) {
  const { data: items, isLoading } = useChecklistItems(tripId);
  const { data: members } = useTripMembers(tripId);
  const mutations = useChecklistMutations(tripId);

  const [sortMode, setSortMode] = useState<SortMode>("created");
  const [showAddForm, setShowAddForm] = useState(false);
  const [editItem, setEditItem] = useState<ChecklistItem | null>(null);
  const [historyItemId, setHistoryItemId] = useState<string | null>(null);
  const [historyItemTitle, setHistoryItemTitle] = useState("");

  const canEdit = userRole === "admin" || userRole === "editor";

  // 카테고리별 그룹핑
  const grouped = useMemo(() => {
    if (!items) return {};
    const map: Record<string, ChecklistItem[]> = {};
    for (const item of items) {
      (map[item.category] ??= []).push(item);
    }
    return map;
  }, [items]);

  // dnd 센서
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id || !items) return;

      const draggedItem = items.find((i) => i.id === active.id);
      if (!draggedItem) return;

      const categoryItems = items
        .filter((i) => i.category === draggedItem.category)
        .sort((a, b) => a.position - b.position);

      const oldIndex = categoryItems.findIndex((i) => i.id === active.id);
      const newIndex = categoryItems.findIndex((i) => i.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = [...categoryItems];
      const [removed] = reordered.splice(oldIndex, 1);
      reordered.splice(newIndex, 0, removed);

      mutations.reorderItems.mutate({
        category: draggedItem.category as ChecklistCategory,
        orderedIds: reordered.map((i) => i.id),
      });
    },
    [items, mutations.reorderItems]
  );

  const handleToggle = useCallback(
    (id: string, checked: boolean) => {
      mutations.toggleCheck.mutate({ id, is_checked: checked });
    },
    [mutations.toggleCheck]
  );

  const handleDelete = useCallback(
    (id: string) => {
      const item = items?.find((i) => i.id === id);
      mutations.deleteItem.mutate(id, {
        onSuccess: () => {
          toast.success(`"${item?.title}" 삭제했어요`);
        },
      });
    },
    [items, mutations.deleteItem]
  );

  const handleShowHistory = useCallback(
    (itemId: string) => {
      const item = items?.find((i) => i.id === itemId);
      setHistoryItemId(itemId);
      setHistoryItemTitle(item?.title ?? "");
    },
    [items]
  );

  // 로딩
  if (isLoading) {
    return (
      <div className="space-y-6 p-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ))}
      </div>
    );
  }

  // 빈 상태
  const isEmpty = !items || items.length === 0;

  return (
    <div className="flex flex-col h-full">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-3 border-b sticky top-0 bg-background z-10">
        <h2 className="text-base font-semibold">체크리스트</h2>
        <SortToggle value={sortMode} onChange={setSortMode} />
      </div>

      {/* 콘텐츠 */}
      <div className="flex-1 overflow-y-auto px-4 py-4 pb-24">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <ListChecks className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <p className="text-muted-foreground mb-1">
              아직 준비물이 없어요
            </p>
            {canEdit && (
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => setShowAddForm(true)}
              >
                <Plus className="h-4 w-4 mr-1" />
                추가해볼까요?
              </Button>
            )}
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <div className="space-y-5">
              {CHECKLIST_CATEGORIES.map((cat) => (
                <CategorySection
                  key={cat.key}
                  category={cat.key}
                  items={grouped[cat.key] ?? []}
                  sortMode={sortMode}
                  userRole={userRole}
                  onToggle={handleToggle}
                  onEdit={setEditItem}
                  onDelete={handleDelete}
                  onShowHistory={handleShowHistory}
                />
              ))}
            </div>
          </DndContext>
        )}
      </div>

      {/* FAB */}
      {canEdit && (
        <Button
          className="fixed bottom-20 right-4 md:bottom-6 md:right-6 h-12 w-12 rounded-full shadow-lg z-20"
          size="icon"
          onClick={() => setShowAddForm(true)}
        >
          <Plus className="h-5 w-5" />
        </Button>
      )}

      {/* 시트/다이얼로그 */}
      <AddItemForm
        open={showAddForm}
        members={members ?? []}
        onSubmit={(data) => {
          mutations.addItem.mutate(data, {
            onSuccess: () => toast.success("추가했어요"),
          });
        }}
        onClose={() => setShowAddForm(false)}
      />

      <EditItemSheet
        item={editItem}
        members={members ?? []}
        onSave={(data) => {
          mutations.updateItem.mutate(data, {
            onSuccess: () => toast.success("수정했어요"),
          });
        }}
        onClose={() => setEditItem(null)}
      />

      <ItemHistory
        itemId={historyItemId}
        itemTitle={historyItemTitle}
        onClose={() => setHistoryItemId(null)}
      />
    </div>
  );
}
