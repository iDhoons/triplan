import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import type {
  ChecklistItem,
  ChecklistLog,
  ChecklistCategory,
  ChecklistPriority,
} from "@/types/database";

export function useChecklistItems(tripId: string) {
  return useQuery({
    queryKey: ["checklist", tripId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("checklist_items")
        .select(
          "*, assignee:profiles!assigned_to(id, display_name, avatar_url)"
        )
        .eq("trip_id", tripId)
        .order("category")
        .order("position");
      if (error) throw error;
      return (data as ChecklistItem[]) ?? [];
    },
    enabled: !!tripId,
  });
}

export function useChecklistLogs(itemId: string | null) {
  return useQuery({
    queryKey: ["checklist_logs", itemId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("checklist_logs")
        .select(
          "*, performer:profiles!performed_by(id, display_name, avatar_url)"
        )
        .eq("checklist_item_id", itemId!)
        .order("performed_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data as ChecklistLog[]) ?? [];
    },
    enabled: !!itemId,
  });
}

interface AddItemPayload {
  category: ChecklistCategory;
  title: string;
  priority?: ChecklistPriority;
  assigned_to?: string | null;
  memo?: string | null;
}

interface UpdateItemPayload {
  id: string;
  title?: string;
  category?: ChecklistCategory;
  priority?: ChecklistPriority;
  assigned_to?: string | null;
  memo?: string | null;
}

export function useChecklistMutations(tripId: string) {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const queryKey = ["checklist", tripId];

  const addItem = useMutation({
    mutationFn: async (payload: AddItemPayload) => {
      if (!user) throw new Error("로그인이 필요합니다");
      const supabase = createClient();

      // 카테고리 내 마지막 position 계산
      const { data: existing } = await supabase
        .from("checklist_items")
        .select("position")
        .eq("trip_id", tripId)
        .eq("category", payload.category)
        .order("position", { ascending: false })
        .limit(1);

      const nextPosition = existing?.[0] ? existing[0].position + 1 : 0;

      const { data, error } = await supabase
        .from("checklist_items")
        .insert({
          trip_id: tripId,
          category: payload.category,
          title: payload.title,
          priority: payload.priority ?? "medium",
          position: nextPosition,
          assigned_to: payload.assigned_to ?? null,
          memo: payload.memo ?? null,
          created_by: user.id,
        })
        .select(
          "*, assignee:profiles!assigned_to(id, display_name, avatar_url)"
        )
        .single();
      if (error) throw error;
      return data as ChecklistItem;
    },
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<ChecklistItem[]>(queryKey);

      const items = previous ?? [];
      const categoryItems = items.filter(
        (i) => i.category === payload.category
      );
      const nextPosition =
        categoryItems.length > 0
          ? Math.max(...categoryItems.map((i) => i.position)) + 1
          : 0;

      const optimisticItem: ChecklistItem = {
        id: `temp-${crypto.randomUUID()}`,
        trip_id: tripId,
        category: payload.category,
        title: payload.title,
        is_checked: false,
        priority: payload.priority ?? "medium",
        position: nextPosition,
        assigned_to: payload.assigned_to ?? null,
        memo: payload.memo ?? null,
        created_by: user?.id ?? "",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      queryClient.setQueryData<ChecklistItem[]>(queryKey, [
        ...items,
        optimisticItem,
      ]);
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
      toast.error("추가에 실패했어요");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ["checklist_global"] });
    },
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, ...updates }: UpdateItemPayload) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("checklist_items")
        .update(updates)
        .eq("id", id)
        .select(
          "*, assignee:profiles!assigned_to(id, display_name, avatar_url)"
        )
        .single();
      if (error) throw error;
      return data as ChecklistItem;
    },
    onError: () => {
      toast.error("수정에 실패했어요");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("checklist_items")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onError: () => {
      toast.error("삭제에 실패했어요");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const toggleCheck = useMutation({
    mutationFn: async ({
      id,
      is_checked,
    }: {
      id: string;
      is_checked: boolean;
    }) => {
      const supabase = createClient();
      // RPC: is_checked만 변경 + 로그는 DB 트리거가 자동 기록
      const { error } = await supabase.rpc("toggle_checklist_check", {
        _item_id: id,
        _is_checked: is_checked,
      });
      if (error) throw error;
    },
    onMutate: async ({ id, is_checked }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<ChecklistItem[]>(queryKey);
      queryClient.setQueryData<ChecklistItem[]>(queryKey, (old) =>
        old?.map((item) =>
          item.id === id ? { ...item, is_checked } : item
        )
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const reorderItems = useMutation({
    mutationFn: async ({
      category,
      orderedIds,
    }: {
      category: ChecklistCategory;
      orderedIds: string[];
    }) => {
      const supabase = createClient();
      // RPC: 단일 트랜잭션으로 배치 순서 변경
      const { error } = await supabase.rpc("reorder_checklist_items", {
        _trip_id: tripId,
        _category: category,
        _ordered_ids: orderedIds,
      });
      if (error) throw error;
    },
    onMutate: async ({ category, orderedIds }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<ChecklistItem[]>(queryKey);
      queryClient.setQueryData<ChecklistItem[]>(queryKey, (old) => {
        if (!old) return old;
        const positionMap = new Map(
          orderedIds.map((id, i) => [id, i])
        );
        return old.map((item) => {
          if (item.category === category && positionMap.has(item.id)) {
            return { ...item, position: positionMap.get(item.id)! };
          }
          return item;
        });
      });
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  return { addItem, updateItem, deleteItem, toggleCheck, reorderItems };
}
