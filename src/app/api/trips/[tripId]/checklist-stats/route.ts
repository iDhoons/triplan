import { withTripMember } from "@/lib/api/guards";
import { errorResponse } from "@/lib/api/error-response";
import { successResponse } from "@/lib/api/response";

// GET /api/trips/[tripId]/checklist-stats — 멤버별 체크리스트 현황
export const GET = withTripMember(
  (request) =>
    request.url.match(/\/trips\/([^/]+)\/checklist-stats/)?.[1] ?? null,
  async (_request, { supabase, tripId }) => {

    const { data: items, error } = await supabase
      .from("checklist_items")
      .select("assigned_to, is_checked")
      .eq("trip_id", tripId);

    if (error) {
      return errorResponse("INTERNAL_ERROR", "Internal server error");
    }

    // 멤버 프로필 조회
    const { data: members } = await supabase
      .from("trip_members")
      .select("user_id, profile:profiles(id, display_name, avatar_url)")
      .eq("trip_id", tripId);

    // 멤버별 집계
    const statsMap = new Map<
      string,
      { total: number; checked: number }
    >();

    // "미할당" 카테고리
    let unassignedTotal = 0;
    let unassignedChecked = 0;

    for (const item of items ?? []) {
      if (!item.assigned_to) {
        unassignedTotal++;
        if (item.is_checked) unassignedChecked++;
        continue;
      }
      if (!statsMap.has(item.assigned_to)) {
        statsMap.set(item.assigned_to, { total: 0, checked: 0 });
      }
      const s = statsMap.get(item.assigned_to)!;
      s.total++;
      if (item.is_checked) s.checked++;
    }

    const memberStats = (members ?? [])
      .filter((m) => statsMap.has(m.user_id))
      .map((m) => ({
        user_id: m.user_id,
        profile: m.profile,
        ...statsMap.get(m.user_id)!,
      }));

    return successResponse({
      members: memberStats,
      unassigned: { total: unassignedTotal, checked: unassignedChecked },
      summary: {
        total: (items ?? []).length,
        checked: (items ?? []).filter((i) => i.is_checked).length,
      },
    });
  },
);
