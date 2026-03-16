"use client";

import { toast } from "sonner";
import { computeTravelInfoForSchedule } from "@/lib/services/travel-info";
import type { Schedule, ScheduleItem, Place } from "@/types/database";
import type { ScheduleItemFormData } from "@/components/schedule/schedule-item-form";

type SupabaseClient = ReturnType<typeof import("@/lib/supabase/client").createClient>;

interface UseScheduleActionsParams {
  supabase: SupabaseClient;
  schedules: Schedule[];
  setSchedules: React.Dispatch<React.SetStateAction<Schedule[]>>;
  refetch: () => Promise<void>;
  targetScheduleId: string | null;
  editingItem: ScheduleItem | null;
}

/**
 * Schedule 페이지의 CRUD + 이동 정보 계산 핸들러를 제공하는 훅.
 */
export function useScheduleActions({
  supabase,
  schedules,
  setSchedules,
  refetch,
  targetScheduleId,
  editingItem,
}: UseScheduleActionsParams) {

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

      await refetch();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await computeTravelInfoForSchedule(supabase as any, targetScheduleId);
    } catch (err) {
      console.error(err);
      toast.error("저장에 실패했습니다.");
      throw err;
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    const { error } = await supabase
      .from("schedule_items")
      .delete()
      .eq("id", itemId);
    if (error) {
      toast.error("삭제에 실패했습니다.");
      return;
    }
    toast.success("일정이 삭제되었습니다.");
    await refetch();
  };

  const handleReorderItems = async (
    scheduleId: string,
    orderedItems: ScheduleItem[]
  ) => {
    setSchedules((prev) =>
      prev.map((s) =>
        s.id === scheduleId ? { ...s, items: orderedItems } : s
      )
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
    } catch {
      toast.error("순서 저장에 실패했습니다.");
      await refetch();
    }
  };

  const handleDropPlace = async (
    scheduleId: string,
    place: Place,
    sortOrder: number
  ) => {
    try {
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
      await refetch();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await computeTravelInfoForSchedule(supabase as any, scheduleId);
    } catch (err) {
      console.error(err);
      toast.error("장소 추가에 실패했습니다.");
    }
  };

  return {
    handleFormSubmit,
    handleDeleteItem,
    handleReorderItems,
    handleDropPlace,
  };
}
