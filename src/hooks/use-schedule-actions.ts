"use client";

import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { computeTravelInfoForSchedule } from "@/lib/services/travel-info";
import type { Schedule, ScheduleItem, Place } from "@/types/database";
import type { ScheduleItemFormData } from "@/components/schedule/schedule-item-form";

type SupabaseClient = ReturnType<typeof import("@/lib/supabase/client").createClient>;

interface UseScheduleActionsParams {
  tripId: string;
  supabase: SupabaseClient;
  schedules: Schedule[];
  targetScheduleId: string | null;
  editingItem: ScheduleItem | null;
}

/**
 * Schedule 페이지의 CRUD + 이동 정보 계산 핸들러 (React Query 연동).
 */
export function useScheduleActions({
  tripId,
  supabase,
  schedules,
  targetScheduleId,
  editingItem,
}: UseScheduleActionsParams) {
  const queryClient = useQueryClient();

  const invalidateSchedules = () =>
    queryClient.invalidateQueries({ queryKey: ["schedules", tripId] });

  const handleFormSubmit = async (data: ScheduleItemFormData) => {
    if (!targetScheduleId) return;

    const payload = {
      schedule_id: targetScheduleId,
      title: data.title.trim(),
      memo: data.memo.trim() || null,
      place_id: data.place_id || null,
      arrival_by: data.arrival_by ? new Date(data.arrival_by).toISOString() : null,
      travel_mode: data.travel_mode || null,
      start_time: null,
      end_time: null,
      transport_to_next: null,
    };

    try {
      if (editingItem) {
        const { error } = await supabase
          .from("schedule_items")
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq("id", editingItem.id);
        if (error) throw error;
        toast.success("일정이 수정되었습니다.");
      } else {
        const schedule = schedules.find((s) => s.id === targetScheduleId);
        const sort_order = (schedule?.items?.length ?? 0) + 1;
        const { error } = await supabase.from("schedule_items").insert({
          ...payload,
          sort_order,
        });
        if (error) throw error;
        toast.success("일정이 추가되었습니다.");
      }

      await invalidateSchedules();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await computeTravelInfoForSchedule(supabase as any, targetScheduleId);
      await invalidateSchedules();
    } catch (err) {
      console.error(err);
      toast.error("저장에 실패했습니다.");
      throw err;
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    // 삭제 전 백업 (Undo용)
    const allItems = schedules.flatMap((s) => s.items ?? []);
    const deletedItem = allItems.find((i) => i.id === itemId);
    const parentSchedule = schedules.find((s) =>
      (s.items ?? []).some((i) => i.id === itemId)
    );

    const { error } = await supabase
      .from("schedule_items")
      .delete()
      .eq("id", itemId);
    if (error) {
      toast.error("삭제에 실패했습니다.");
      return;
    }
    await invalidateSchedules();
    toast("일정이 삭제되었어요", {
      action: {
        label: "되돌리기",
        onClick: async () => {
          if (!deletedItem || !parentSchedule) return;
          await supabase.from("schedule_items").insert({
            id: deletedItem.id,
            schedule_id: parentSchedule.id,
            title: deletedItem.title,
            memo: deletedItem.memo,
            place_id: deletedItem.place_id,
            sort_order: deletedItem.sort_order,
            arrival_by: deletedItem.arrival_by,
            travel_mode: deletedItem.travel_mode,
            travel_duration_seconds: deletedItem.travel_duration_seconds,
            travel_distance_meters: deletedItem.travel_distance_meters,
          });
          await invalidateSchedules();
          toast.success("일정이 복원되었어요");
        },
      },
      duration: 5000,
    });
  };

  const handleReorderItems = async (
    scheduleId: string,
    orderedItems: ScheduleItem[]
  ) => {
    // Optimistic update via React Query cache
    queryClient.setQueryData<Schedule[]>(
      ["schedules", tripId],
      (old) =>
        old?.map((s) =>
          s.id === scheduleId ? { ...s, items: orderedItems } : s
        ) ?? []
    );

    try {
      await Promise.all(
        orderedItems.map((item) =>
          supabase
            .from("schedule_items")
            .update({ sort_order: item.sort_order, updated_at: new Date().toISOString() })
            .eq("id", item.id)
        )
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await computeTravelInfoForSchedule(supabase as any, scheduleId);
      await invalidateSchedules();
    } catch {
      toast.error("순서 저장에 실패했습니다.");
      await invalidateSchedules(); // revert via refetch
    }
  };

  const handleDropPlace = async (
    scheduleId: string,
    place: Place,
    sortOrder: number
  ) => {
    try {
      // 중간 삽입: 기존 아이템의 sort_order를 밀어서 자리 확보
      const schedule = schedules.find((s) => s.id === scheduleId);
      const existingItems = schedule?.items ?? [];
      const itemsToShift = existingItems.filter(
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

      const { error } = await supabase.from("schedule_items").insert({
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
      });
      if (error) throw error;
      toast.success(`"${place.name}" 을(를) 일정에 추가했습니다.`);
      await invalidateSchedules();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await computeTravelInfoForSchedule(supabase as any, scheduleId);
      await invalidateSchedules();
    } catch (err) {
      console.error(err);
      toast.error("장소 추가에 실패했습니다.");
    }
  };

  const handleMoveItem = async (
    itemId: string,
    fromScheduleId: string,
    toScheduleId: string,
    sortOrder: number
  ) => {
    try {
      // 1. 대상 스케줄에서 sort_order 밀기
      const targetSchedule = schedules.find((s) => s.id === toScheduleId);
      const itemsToShift = (targetSchedule?.items ?? []).filter(
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
      const sourceSchedule = schedules.find((s) => s.id === fromScheduleId);
      const remainingItems = (sourceSchedule?.items ?? [])
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

      toast.success("일정을 이동했습니다.");
      await invalidateSchedules();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await Promise.all([
        computeTravelInfoForSchedule(supabase as any, fromScheduleId),
        computeTravelInfoForSchedule(supabase as any, toScheduleId),
      ]);
      await invalidateSchedules();
    } catch (err) {
      console.error(err);
      toast.error("일정 이동에 실패했습니다.");
    }
  };

  return {
    handleFormSubmit,
    handleDeleteItem,
    handleReorderItems,
    handleDropPlace,
    handleMoveItem,
  };
}
