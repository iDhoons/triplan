import { withTripMember } from "@/lib/api/guards";
import { NextResponse } from "next/server";

// GET /api/trips/[tripId]/stats — 멤버별 기여도 집계
export const GET = withTripMember(
  (request) => request.url.match(/\/trips\/([^/]+)\/stats/)?.[1] ?? null,
  async (_request, { supabase }) => {
    const tripId = _request.url.match(/\/trips\/([^/]+)\/stats/)?.[1] ?? "";

    // activity_logs에서 멤버별 액션 카운트 집계
    const { data: logs, error } = await supabase
      .from("activity_logs")
      .select("user_id, action")
      .eq("trip_id", tripId);

    if (error) {
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    // 멤버 프로필 조회
    const { data: members } = await supabase
      .from("trip_members")
      .select("user_id, role, profile:profiles(id, display_name, avatar_url)")
      .eq("trip_id", tripId);

    // 멤버별 기여도 집계
    const statsMap = new Map<
      string,
      { places: number; votes: number; checklist: number; schedule: number; total: number }
    >();

    for (const log of logs ?? []) {
      if (!statsMap.has(log.user_id)) {
        statsMap.set(log.user_id, { places: 0, votes: 0, checklist: 0, schedule: 0, total: 0 });
      }
      const s = statsMap.get(log.user_id)!;
      s.total++;

      if (log.action.startsWith("place_")) s.places++;
      else if (log.action === "vote_added") s.votes++;
      else if (log.action.startsWith("checklist_")) s.checklist++;
      else if (log.action.startsWith("schedule_item_")) s.schedule++;
    }

    const stats = (members ?? []).map((m) => ({
      user_id: m.user_id,
      role: m.role,
      profile: m.profile,
      contributions: statsMap.get(m.user_id) ?? {
        places: 0,
        votes: 0,
        checklist: 0,
        schedule: 0,
        total: 0,
      },
    }));

    // total 기준 내림차순 정렬
    stats.sort((a, b) => b.contributions.total - a.contributions.total);

    return NextResponse.json({ stats });
  },
);
