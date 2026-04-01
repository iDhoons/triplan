import type { Schedule, ScheduleItem } from "@/types/database";
import type { SupabaseClient } from "@/lib/api/guards";

/**
 * 특정 schedule의 인접 아이템 간 이동 정보를 자동 계산한다.
 * - 양쪽 좌표가 있고 아직 캐싱되지 않은 경우에만 호출
 * - Google Directions API → DB 캐싱
 * - 개별 실패는 무시하고 다음 항목 계속 처리
 */
export async function computeTravelInfoForSchedule(
  supabase: SupabaseClient,
  scheduleId: string
): Promise<void> {
  const { data } = await supabase
    .from("schedules")
    .select("*, items:schedule_items(*, place:places(*))")
    .eq("id", scheduleId)
    .single();

  if (!data) return;

  const items = ((data as Schedule).items ?? [])
    .slice()
    .sort((a: ScheduleItem, b: ScheduleItem) => a.sort_order - b.sort_order);

  for (let i = 1; i < items.length; i++) {
    const prev = items[i - 1];
    const curr = items[i];

    if (curr.travel_duration_seconds != null) continue;

    if (
      prev.place?.latitude == null || prev.place?.longitude == null ||
      curr.place?.latitude == null || curr.place?.longitude == null
    ) continue;

    const mode = curr.travel_mode || "transit";

    try {
      const res = await fetch(
        `/api/directions?origin=${prev.place.latitude},${prev.place.longitude}&destination=${curr.place.latitude},${curr.place.longitude}&mode=${mode}`
      );
      if (!res.ok) continue;

      const result = await res.json();

      await supabase
        .from("schedule_items")
        .update({
          travel_duration_seconds: result.duration_seconds,
          travel_distance_meters: result.distance_meters,
          travel_mode: mode,
          updated_at: new Date().toISOString(),
        })
        .eq("id", curr.id);
    } catch {
      // 개별 실패는 무시
    }
  }
}
