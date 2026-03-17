import {
  FileText,
  Shirt,
  Plug,
  Heart,
  Users,
  CheckSquare,
  ShoppingBag,
  type LucideIcon,
} from "lucide-react";
import type { ChecklistCategory, ChecklistPriority } from "@/types/database";

export interface CategoryMeta {
  key: ChecklistCategory;
  label: string;
  icon: LucideIcon;
}

export const CHECKLIST_CATEGORIES: CategoryMeta[] = [
  { key: "documents", label: "필수 서류", icon: FileText },
  { key: "clothing", label: "의류", icon: Shirt },
  { key: "electronics", label: "전자기기", icon: Plug },
  { key: "hygiene", label: "세면/의약", icon: Heart },
  { key: "shared", label: "공동 준비물", icon: Users },
  { key: "todo", label: "할 일", icon: CheckSquare },
  { key: "shopping", label: "쇼핑", icon: ShoppingBag },
];

export const CATEGORY_MAP = Object.fromEntries(
  CHECKLIST_CATEGORIES.map((c) => [c.key, c])
) as Record<ChecklistCategory, CategoryMeta>;

export const PRIORITY_CONFIG: Record<
  ChecklistPriority,
  { label: string; className: string }
> = {
  high: { label: "높음", className: "bg-red-100 text-red-700" },
  medium: { label: "보통", className: "" },
  low: { label: "낮음", className: "text-muted-foreground" },
};

export type SortMode = "created" | "priority" | "manual";

export const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: "created", label: "생성순" },
  { value: "priority", label: "급한순서" },
  { value: "manual", label: "수동 정렬" },
];

const PRIORITY_ORDER: Record<ChecklistPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

export function sortItems<T extends { is_checked: boolean; priority: ChecklistPriority; position: number; created_at: string }>(
  items: T[],
  mode: SortMode
): T[] {
  const sorted = [...items];
  switch (mode) {
    case "created":
      return sorted.sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    case "priority":
      return sorted.sort((a, b) => {
        const checkedDiff = Number(a.is_checked) - Number(b.is_checked);
        if (checkedDiff !== 0) return checkedDiff;
        return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
      });
    case "manual":
      return sorted.sort((a, b) => a.position - b.position);
  }
}
