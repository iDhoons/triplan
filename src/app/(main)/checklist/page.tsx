"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  ListChecks,
  ChevronRight,
  MapPin,
  Calendar,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { queryKeys } from "@/hooks/query-keys";
import { useChecklistMutations } from "@/hooks/use-checklist";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { InlineAddInput } from "@/components/checklist/inline-add-input";
import { cn } from "@/lib/utils";
import { CATEGORY_MAP } from "@/components/checklist/constants";
import type { ChecklistItem, Trip, MemberRole } from "@/types/database";

interface TripWithChecklist {
  trip: Trip;
  items: ChecklistItem[];
  total: number;
  checked: number;
  userRole: MemberRole;
}

const GLOBAL_QUERY_KEY = queryKeys.checklist.global;

function useAllChecklists() {
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: [...GLOBAL_QUERY_KEY, user?.id],
    queryFn: async () => {
      const supabase = createClient();

      const { data: memberships, error: mErr } = await supabase
        .from("trip_members")
        .select("trip_id, role, trip:trips(*)")
        .eq("user_id", user!.id)
        .order("joined_at", { ascending: false });
      if (mErr) throw mErr;

      const tripIds = memberships?.map((m) => m.trip_id) ?? [];
      if (tripIds.length === 0) return [];

      const { data: allItems, error: iErr } = await supabase
        .from("checklist_items")
        .select("*")
        .in("trip_id", tripIds)
        .order("category")
        .order("position");
      if (iErr) throw iErr;

      const itemsByTrip = new Map<string, ChecklistItem[]>();
      for (const item of (allItems as ChecklistItem[]) ?? []) {
        const list = itemsByTrip.get(item.trip_id) ?? [];
        list.push(item);
        itemsByTrip.set(item.trip_id, list);
      }

      const result: TripWithChecklist[] = [];
      for (const m of memberships ?? []) {
        const trip = m.trip as unknown as Trip;
        if (!trip) continue;
        const items = itemsByTrip.get(m.trip_id) ?? [];
        result.push({
          trip,
          items,
          total: items.length,
          checked: items.filter((i) => i.is_checked).length,
          userRole: m.role as MemberRole,
        });
      }

      return result;
    },
    enabled: !!user,
  });
}

function useGlobalToggleCheck() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  return useMutation({
    mutationFn: async ({ id, is_checked }: { id: string; is_checked: boolean }) => {
      const supabase = createClient();
      const { error } = await supabase.rpc("toggle_checklist_check", {
        _item_id: id,
        _is_checked: is_checked,
      });
      if (error) throw error;
    },
    onMutate: async ({ id, is_checked }) => {
      const queryKey = [...GLOBAL_QUERY_KEY, user?.id];
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<TripWithChecklist[]>(queryKey);

      queryClient.setQueryData<TripWithChecklist[]>(queryKey, (old) =>
        old?.map((tc) => {
          const hasItem = tc.items.some((i) => i.id === id);
          if (!hasItem) return tc;
          const newItems = tc.items.map((i) =>
            i.id === id ? { ...i, is_checked } : i
          );
          return {
            ...tc,
            items: newItems,
            checked: newItems.filter((i) => i.is_checked).length,
          };
        })
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData([...GLOBAL_QUERY_KEY, user?.id], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: GLOBAL_QUERY_KEY });
    },
  });
}

function formatDateRange(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  const fmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
  return `${fmt(s)}\u2013${fmt(e)}`;
}

export default function GlobalChecklistPage() {
  const { data: tripChecklists, isLoading } = useAllChecklists();

  if (isLoading) {
    return (
      <div className="space-y-6 p-4">
        {[1, 2].map((i) => (
          <div key={i} className="space-y-3">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
      </div>
    );
  }

  const isEmpty = !tripChecklists || tripChecklists.length === 0;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b sticky top-0 bg-background z-10">
        <h1 className="text-base font-semibold">체크리스트</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 pb-24 space-y-5">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <ListChecks className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <p className="text-muted-foreground">
              참여 중인 여행이 없어요
            </p>
          </div>
        ) : (
          tripChecklists.map((tc) => (
            <TripChecklistSection key={tc.trip.id} {...tc} />
          ))
        )}
      </div>
    </div>
  );
}

function TripChecklistSection({
  trip,
  items,
  total,
  checked,
  userRole,
}: TripWithChecklist) {
  const [showInlineAdd, setShowInlineAdd] = useState(false);
  const mutations = useChecklistMutations(trip.id);
  const uncheckedItems = items.filter((i) => !i.is_checked);
  const checkedItems = items.filter((i) => i.is_checked);
  const progress = total > 0 ? Math.round((checked / total) * 100) : 0;
  const canEdit = userRole === "admin" || userRole === "editor";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Link
          href={`/trips/${trip.id}/checklist`}
          className="flex items-center justify-between flex-1 group min-w-0"
        >
          <div className="min-w-0">
            <h2 className="text-sm font-semibold truncate group-hover:text-primary transition-colors">
              {trip.title}
            </h2>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
              <span className="flex items-center gap-0.5">
                <MapPin className="size-3" />
                {trip.destination}
              </span>
              <span className="flex items-center gap-0.5">
                <Calendar className="size-3" />
                {formatDateRange(trip.start_date, trip.end_date)}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {total > 0 && (
              <Badge variant="secondary" className="text-xs">
                {checked}/{total}
              </Badge>
            )}
            <ChevronRight className="size-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
        </Link>
        {canEdit && (
          <button
            className="p-1 rounded hover:bg-muted transition-colors ml-1 shrink-0"
            onClick={() => setShowInlineAdd(true)}
            aria-label="항목 추가"
          >
            <Plus className="size-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {total > 0 && (
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      <div className="space-y-1">
        {uncheckedItems.slice(0, 5).map((item) => (
          <CompactChecklistItem key={item.id} item={item} />
        ))}
        {uncheckedItems.length > 5 && (
          <Link
            href={`/trips/${trip.id}/checklist`}
            className="text-xs text-primary hover:underline pl-7 block py-1"
          >
            +{uncheckedItems.length - 5}개 더 보기
          </Link>
        )}
        {checkedItems.length > 0 && (
          <p className="text-xs text-muted-foreground/60 pl-7 pt-1">
            {checkedItems.length}개 완료됨
          </p>
        )}
      </div>

      {showInlineAdd && (
        <InlineAddInput
          placeholder="항목 추가..."
          onAdd={(title) => {
            mutations.addItem.mutate(
              { category: "shared", title, priority: "medium" },
              { onSuccess: () => toast.success("추가했어요") }
            );
          }}
          onCancel={() => setShowInlineAdd(false)}
        />
      )}

      {total === 0 && !showInlineAdd && canEdit && (
        <button
          className="text-xs text-muted-foreground/60 hover:text-primary transition-colors py-1"
          onClick={() => setShowInlineAdd(true)}
        >
          + 준비물을 추가해 보세요
        </button>
      )}
    </div>
  );
}

function CompactChecklistItem({ item }: { item: ChecklistItem }) {
  const toggleCheck = useGlobalToggleCheck();
  const catMeta = CATEGORY_MAP[item.category];

  return (
    <div className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-muted/50 transition-colors">
      <button
        className="flex-shrink-0"
        onClick={() => toggleCheck.mutate({ id: item.id, is_checked: !item.is_checked })}
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
            <svg
              className="h-3 w-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={3}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
      </button>
      <span
        className={cn(
          "text-sm flex-1 truncate",
          item.is_checked && "line-through text-muted-foreground"
        )}
      >
        {item.title}
      </span>
      {item.priority === "high" && (
        <Badge
          variant="secondary"
          className="text-[10px] px-1.5 py-0 bg-red-100 text-red-700"
        >
          긴급
        </Badge>
      )}
      {catMeta && (
        <span className="text-[10px] text-muted-foreground hidden sm:inline">
          {catMeta.label}
        </span>
      )}
    </div>
  );
}
