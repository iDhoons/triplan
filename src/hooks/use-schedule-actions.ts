"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { queryKeys } from "./query-keys";
import { computeTravelInfoForSchedule } from "@/lib/services/travel-info";
import type { Schedule, ScheduleItem, Place, TravelMode } from "@/types/database";
import type { ScheduleItemFormData } from "@/components/schedule/schedule-item-form";

import type { SupabaseClient } from "@/lib/api/guards";

interface UseScheduleActionsParams {
  tripId: string;
  supabase: SupabaseClient;
  targetScheduleId: string | null;
  editingItem: ScheduleItem | null;
}

interface FormSubmitParams {
  data: ScheduleItemFormData;
  schedules: Schedule[];
}

interface ReorderItemsParams {
  scheduleId: string;
  orderedItems: ScheduleItem[];
}

interface DropPlaceParams {
  scheduleId: string;
  place: Place;
  sortOrder: number;
  schedules: Schedule[];
}

interface MoveItemParams {
  itemId: string;
  fromScheduleId: string;
  toScheduleId: string;
  sortOrder: number;
  schedules: Schedule[];
}

/**
 * Schedule 페이지의 CRUD + 이동 정보 계산 핸들러 (React Query useMutation 기반).
 *
 * optimisticUpdates로 오프라인 지원 및 즉시 UI 반영.
 */
export function useScheduleActions({
  tripId,
  supabase,
  targetScheduleId,
  editingItem,
}: UseScheduleActionsParams) {
  const queryClient = useQueryClient();
  const dataQueryKey = queryKeys.schedules.data(tripId);

  const invalidateSchedules = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.schedules.byTrip(tripId) }),
      queryClient.invalidateQueries({ queryKey: dataQueryKey }),
    ]);
  };

  // --- mutation: 일정 추가/수정 ---
  const submitMutation = useMutation({
    mutationFn: async ({ data, schedules }: FormSubmitParams) => {
      if (!targetScheduleId) throw new Error("대상 일정이 선택되지 않았습니다.");

      const payload = {
        schedule_id: targetScheduleId,
        title: data.title.trim(),
        memo: data.memo.trim() || null,
        place_id: data.place_id || null,
        arrival_by: data.arrival_by ? new Date(data.arrival_by).toISOString() : null,
        travel_mode: data.travel_mode || null,
        // "HH:MM" → "HH:MM:00" (TIME 컬럼 호환)
        start_time: data.start_time ? `${data.start_time}:00` : null,
        end_time: null,
        transport_to_next: null,
      };

      if (editingItem) {
        const { error } = await supabase
          .from("schedule_items")
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq("id", editingItem.id);
        if (error) throw error;
        return { action: "update", itemId: editingItem.id, scheduleId: targetScheduleId };
      } else {
        const schedule = schedules.find((s) => s.id === targetScheduleId);
        const sort_order = (schedule?.items?.length ?? 0) + 1;
        const { data: inserted, error } = await supabase
          .from("schedule_items")
          .insert({ ...payload, sort_order })
          .select("id")
          .single();
        if (error) throw error;
        return { action: "create", itemId: inserted.id, scheduleId: targetScheduleId };
      }
    },
    onMutate: async ({ data, schedules }) => {
      await queryClient.cancelQueries({ queryKey: dataQueryKey });
      const previous = queryClient.getQueryData<{
        trip: unknown;
        schedules: Schedule[];
        places: Place[];
      }>(dataQueryKey);

      if (!previous) return { previous };

      const tempId = `temp-${crypto.randomUUID()}`;
      const now = new Date().toISOString();

      if (editingItem) {
        // 수정: 낙관적 업데이트
        queryClient.setQueryData(dataQueryKey, (old: typeof previous) => {
          if (!old) return old;
          return {
            ...old,
            schedules: old.schedules.map((s) => {
              if (s.id !== targetScheduleId) return s;
              return {
                ...s,
                items: s.items?.map((i) =>
                  i.id === editingItem.id
                    ? {
                        ...i,
                        title: data.title.trim(),
                        memo: data.memo.trim() || null,
                        place_id: data.place_id || null,
                        arrival_by: data.arrival_by ? new Date(data.arrival_by).toISOString() : null,
                        travel_mode: data.travel_mode || null,
                        start_time: data.start_time ? `${data.start_time}:00` : null,
                        updated_at: now,
                      }
                    : i
                ),
              };
            }),
          };
        });
      } else {
        // 추가: 낙관적 업데이트
        const newItems: ScheduleItem = {
          id: tempId,
          schedule_id: targetScheduleId!,
          parent_id: null,
          item_type: "place",
          place_id: data.place_id || null,
          title: data.title.trim(),
          start_time: data.start_time ? `${data.start_time}:00` : null,
          end_time: null,
          sort_order: (schedules.find((s) => s.id === targetScheduleId)?.items?.length ?? 0) + 1,
          memo: data.memo.trim() || null,
          transport_to_next: null,
          arrival_by: data.arrival_by ? new Date(data.arrival_by).toISOString() : null,
          travel_duration_seconds: null,
          travel_distance_meters: null,
          travel_mode: (data.travel_mode || null) as TravelMode | null,
          notify_before_minutes: 0,
          created_at: now,
          updated_at: now,
        };

        queryClient.setQueryData(dataQueryKey, (old: typeof previous) => {
          if (!old) return old;
          return {
            ...old,
            schedules: old.schedules.map((s) => {
              if (s.id !== targetScheduleId) return s;
              return {
                ...s,
                items: [...(s.items ?? []), newItems],
              };
            }),
          };
        });
      }

      return { previous, tempId };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(dataQueryKey, context.previous);
      }
      toast.error("저장에 실패했습니다.");
    },
    onSuccess: (result) => {
      if (result.action === "create") {
        toast.success("일정이 추가되었습니다.");
      } else {
        toast.success("일정이 수정되었습니다.");
      }
    },
    onSettled: () => {
      // temp ID cleanup: invalidate triggers refetch with real data
      void invalidateSchedules();
      // 이동거리 계산은 백그라운드 업데이트
      computeTravelInfoForSchedule(supabase, targetScheduleId!).then(invalidateSchedules);
    },
  });

  // --- mutation: 일정 삭제 ---
  const deleteMutation = useMutation({
    mutationFn: async ({ itemId }: { itemId: string }) => {
      const { error } = await supabase
        .from("schedule_items")
        .delete()
        .eq("id", itemId);
      if (error) throw error;
      return { itemId };
    },
    onMutate: async ({ itemId }) => {
      await queryClient.cancelQueries({ queryKey: dataQueryKey });
      const previous = queryClient.getQueryData<{
        trip: unknown;
        schedules: Schedule[];
        places: Place[];
      }>(dataQueryKey);

      // 삭제할 아이템 찾기 (Undo용)
      let deletedItem: ScheduleItem | null = null;
      let parentScheduleId: string | null = null;

      if (previous) {
        for (const s of previous.schedules) {
          const item = (s.items ?? []).find((i) => i.id === itemId);
          if (item) {
            deletedItem = item;
            parentScheduleId = s.id;
            break;
          }
        }
      }

      // 낙관적 삭제
      queryClient.setQueryData(dataQueryKey, (old: typeof previous) => {
        if (!old) return old;
        return {
          ...old,
          schedules: old.schedules.map((s) => ({
            ...s,
            items: s.items?.filter((i) => i.id !== itemId) ?? [],
          })),
        };
      });

      return { previous, deletedItem, parentScheduleId };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(dataQueryKey, context.previous);
      }
      toast.error("삭제에 실패했습니다.");
    },
    onSuccess: (_data, _vars, context) => {
      toast("일정이 삭제되었어요", {
        action: context?.deletedItem
          ? {
              label: "되돌리기",
              onClick: async () => {
                if (!context.deletedItem || !context.parentScheduleId) return;
                const { error: restoreError } = await supabase
                  .from("schedule_items")
                  .insert({
                    id: context.deletedItem.id,
                    schedule_id: context.parentScheduleId,
                    title: context.deletedItem.title,
                    memo: context.deletedItem.memo,
                    place_id: context.deletedItem.place_id,
                    sort_order: context.deletedItem.sort_order,
                    arrival_by: context.deletedItem.arrival_by,
                    travel_mode: context.deletedItem.travel_mode,
                    travel_duration_seconds: context.deletedItem.travel_duration_seconds,
                    travel_distance_meters: context.deletedItem.travel_distance_meters,
                    item_type: context.deletedItem.item_type,
                    parent_id: context.deletedItem.parent_id,
                    start_time: context.deletedItem.start_time,
                    end_time: context.deletedItem.end_time,
                    transport_to_next: context.deletedItem.transport_to_next,
                    notify_before_minutes: context.deletedItem.notify_before_minutes,
                  });
                if (restoreError) {
                  toast.error("복원에 실패했습니다. 다시 시도해주세요.");
                  return;
                }
                await invalidateSchedules();
                toast.success("일정이 복원되었어요");
              },
            }
          : undefined,
        duration: 5000,
      });
    },
    onSettled: () => {
      void invalidateSchedules();
    },
  });

  // --- mutation: 순서 변경 ---
  const reorderMutation = useMutation({
    mutationFn: async ({ scheduleId, orderedItems }: ReorderItemsParams) => {
      const { error } = await supabase.rpc("reorder_schedule_items", {
        _schedule_id: scheduleId,
        _ordered_ids: orderedItems.map((i) => i.id),
      });
      if (error) throw error;
      return { scheduleId };
    },
    onMutate: async ({ scheduleId, orderedItems }) => {
      await queryClient.cancelQueries({ queryKey: dataQueryKey });
      const previous = queryClient.getQueryData<{
        trip: unknown;
        schedules: Schedule[];
        places: Place[];
      }>(dataQueryKey);

      // 낙관적 업데이트
      queryClient.setQueryData(dataQueryKey, (old: typeof previous) => {
        if (!old) return old;
        return {
          ...old,
          schedules: old.schedules.map((s) =>
            s.id === scheduleId ? { ...s, items: orderedItems } : s
          ),
        };
      });

      return { previous, scheduleId };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(dataQueryKey, context.previous);
      }
      toast.error("순서 저장에 실패했습니다.");
    },
    onSettled: (_data, _error, _vars, context) => {
      void invalidateSchedules();
      // 이동거리 계산
      if (context && "scheduleId" in context) {
        computeTravelInfoForSchedule(supabase, context.scheduleId).then(invalidateSchedules);
      }
    },
  });

  // --- mutation: 장소 드롭 추가 ---
  const dropPlaceMutation = useMutation({
    mutationFn: async ({ scheduleId, place, sortOrder }: DropPlaceParams) => {
      // 중간 삽입: 기존 아이템의 sort_order를 밀어서 자리 확보
      const scheduleData = await queryClient.fetchQuery({
        queryKey: dataQueryKey,
        queryFn: async () => {
          const { data } = await supabase
            .from("schedules")
            .select("*, items:schedule_items(id, sort_order)")
            .eq("id", scheduleId)
            .single();
          return data;
        },
      });

      const existingItems = (scheduleData as Schedule | null)?.items ?? [];
      const itemsToShift = existingItems.filter((i) => i.sort_order >= sortOrder);

      if (itemsToShift.length > 0) {
        await Promise.all(
          itemsToShift.map((item) =>
            supabase
              .from("schedule_items")
              .update({
                sort_order: item.sort_order + 1,
                updated_at: new Date().toISOString(),
              })
              .eq("id", item.id)
          )
        );
      }

      const { data: inserted, error } = await supabase
        .from("schedule_items")
        .insert({
          schedule_id: scheduleId,
          place_id: place.id,
          title: place.name,
          sort_order: sortOrder,
          start_time: null,
          end_time: null,
          memo: null,
          transport_to_next: null,
          arrival_by: null,
          travel_mode: null,
        })
        .select("id")
        .single();
      if (error) throw error;
      return { scheduleId, itemId: inserted.id, place, sortOrder };
    },
    onMutate: async ({ scheduleId, place, sortOrder }) => {
      await queryClient.cancelQueries({ queryKey: dataQueryKey });
      const previous = queryClient.getQueryData<{
        trip: unknown;
        schedules: Schedule[];
        places: Place[];
      }>(dataQueryKey);

      const tempId = `temp-${crypto.randomUUID()}`;
      const now = new Date().toISOString();

      // 낙관적 추가
      const newItem: ScheduleItem = {
        id: tempId,
        schedule_id: scheduleId,
        parent_id: null,
        item_type: "place",
        place_id: place.id,
        title: place.name,
        start_time: null,
        end_time: null,
        sort_order: sortOrder,
        memo: null,
        transport_to_next: null,
        arrival_by: null,
        travel_duration_seconds: null,
        travel_distance_meters: null,
        travel_mode: null,
        notify_before_minutes: 0,
        created_at: now,
        updated_at: now,
      };

      queryClient.setQueryData(dataQueryKey, (old: typeof previous) => {
        if (!old) return old;
        return {
          ...old,
          schedules: old.schedules.map((s) => {
            if (s.id !== scheduleId) return s;
            const items = s.items ?? [];
            // 중간 삽입 위치 계산
            const beforeItems = items.filter((i) => i.sort_order < sortOrder);
            const afterItems = items.filter((i) => i.sort_order >= sortOrder);
            return {
              ...s,
              items: [...beforeItems, newItem, ...afterItems],
            };
          }),
        };
      });

      return { previous, tempId, scheduleId };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(dataQueryKey, context.previous);
      }
      toast.error("장소 추가에 실패했습니다.");
    },
    onSuccess: ({ place }) => {
      toast.success(`"${place.name}" 을(를) 일정에 추가했습니다.`);
    },
    onSettled: (_data, _error, _vars, context) => {
      void invalidateSchedules();
      if (context && "scheduleId" in context) {
        computeTravelInfoForSchedule(supabase, context.scheduleId).then(invalidateSchedules);
      }
    },
  });

  // --- mutation: 아이템 이동 (크로스 스케줄) ---
  const moveItemMutation = useMutation({
    mutationFn: async ({
      itemId,
      fromScheduleId,
      toScheduleId,
      sortOrder,
    }: MoveItemParams) => {
      // 1. 대상 스케줄에서 sort_order 밀기
      const targetScheduleData = await queryClient.fetchQuery({
        queryKey: dataQueryKey,
        queryFn: async () => {
          const { data } = await supabase
            .from("schedules")
            .select("id, items:schedule_items(id, sort_order)")
            .eq("id", toScheduleId)
            .single();
          return data as Schedule | null;
        },
      });

      const itemsToShift = (targetScheduleData?.items ?? []).filter(
        (i) => i.sort_order >= sortOrder
      );
      if (itemsToShift.length > 0) {
        await Promise.all(
          itemsToShift.map((item) =>
            supabase
              .from("schedule_items")
              .update({
                sort_order: item.sort_order + 1,
                updated_at: new Date().toISOString(),
              })
              .eq("id", item.id)
          )
        );
      }

      // 2. 아이템을 새 스케줄로 이동
      const { error } = await supabase
        .from("schedule_items")
        .update({
          schedule_id: toScheduleId,
          sort_order: sortOrder,
          updated_at: new Date().toISOString(),
        })
        .eq("id", itemId);
      if (error) throw error;

      // 3. 소스 스케줄 sort_order 정리
      const sourceScheduleData = await queryClient.fetchQuery({
        queryKey: dataQueryKey,
        queryFn: async () => {
          const { data } = await supabase
            .from("schedules")
            .select("id, items:schedule_items(id, sort_order)")
            .eq("id", fromScheduleId)
            .single();
          return data as Schedule | null;
        },
      });

      const remainingItems = (sourceScheduleData?.items ?? [])
        .filter((i) => i.id !== itemId)
        .sort((a, b) => a.sort_order - b.sort_order);
      if (remainingItems.length > 0) {
        await Promise.all(
          remainingItems.map((item, idx) =>
            supabase
              .from("schedule_items")
              .update({
                sort_order: idx + 1,
                updated_at: new Date().toISOString(),
              })
              .eq("id", item.id)
          )
        );
      }

      return { fromScheduleId, toScheduleId };
    },
    onMutate: async ({ itemId, fromScheduleId, toScheduleId, sortOrder, schedules }) => {
      await queryClient.cancelQueries({ queryKey: dataQueryKey });
      const previous = queryClient.getQueryData<{
        trip: unknown;
        schedules: Schedule[];
        places: Place[];
      }>(dataQueryKey);

      // 이동할 아이템 찾기
      let movedItem: ScheduleItem | null = null;
      for (const s of schedules) {
        const item = (s.items ?? []).find((i) => i.id === itemId);
        if (item) {
          movedItem = { ...item, schedule_id: toScheduleId, sort_order: sortOrder };
          break;
        }
      }

      // 낙관적 업데이트
      queryClient.setQueryData(dataQueryKey, (old: typeof previous) => {
        if (!old || !movedItem) return old;
        return {
          ...old,
          schedules: old.schedules
            .map((s) => {
              // 소스 스케줄: 아이템 제거
              if (s.id === fromScheduleId) {
                return {
                  ...s,
                  items: s.items?.filter((i) => i.id !== itemId) ?? [],
                };
              }
              return s;
            })
            .map((s) => {
              // 대상 스케줄: 아이템 추가
              if (s.id === toScheduleId) {
                const items = s.items ?? [];
                const beforeItems = items.filter((i) => i.sort_order < sortOrder);
                const afterItems = items.filter((i) => i.sort_order >= sortOrder);
                return {
                  ...s,
                  items: [...beforeItems, movedItem, ...afterItems],
                };
              }
              return s;
            }),
        };
      });

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(dataQueryKey, context.previous);
      }
      toast.error("일정 이동에 실패했습니다.");
    },
    onSuccess: () => {
      toast.success("일정을 이동했습니다.");
    },
    onSettled: (_data, _error, vars, context) => {
      void invalidateSchedules();
      if (context) {
        Promise.all([
          computeTravelInfoForSchedule(supabase, vars.fromScheduleId),
          computeTravelInfoForSchedule(supabase, vars.toScheduleId),
        ]).then(invalidateSchedules);
      }
    },
  });

  /**
   * 폼 제출 (추가/수정)
   */
  const handleFormSubmit = async (data: ScheduleItemFormData, schedules: Schedule[]) => {
    await submitMutation.mutateAsync({ data, schedules });
  };

  /**
   * 일정 삭제
   */
  const handleDeleteItem = async (itemId: string) => {
    await deleteMutation.mutateAsync({ itemId });
  };

  /**
   * 아이템 순서 변경
   */
  const handleReorderItems = async (scheduleId: string, orderedItems: ScheduleItem[]) => {
    await reorderMutation.mutateAsync({ scheduleId, orderedItems });
  };

  /**
   * 장소 드롭 추가
   */
  const handleDropPlace = async (scheduleId: string, place: Place, sortOrder: number, schedules: Schedule[]) => {
    await dropPlaceMutation.mutateAsync({ scheduleId, place, sortOrder, schedules });
  };

  /**
   * 아이템 이동 (크로스 스케줄)
   */
  const handleMoveItem = async (
    itemId: string,
    fromScheduleId: string,
    toScheduleId: string,
    sortOrder: number,
    schedules: Schedule[]
  ) => {
    await moveItemMutation.mutateAsync({
      itemId,
      fromScheduleId,
      toScheduleId,
      sortOrder,
      schedules,
    });
  };

  return {
    handleFormSubmit,
    handleDeleteItem,
    handleReorderItems,
    handleDropPlace,
    handleMoveItem,
    // Mutation states for loading indicators
    isSubmitting: submitMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
