import { withTripMember } from "@/lib/api/guards";
import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api/error-response";

// GET /api/trips/[tripId]/stats — 멤버별 기여도 집계
export const GET = withTripMember(
  (request) => request.url.match(/\/trips\/([^/]+)\/stats/)?.[1] ?? null,
  async (_request, { supabase, tripId }) => {

    // SQL GROUP BY로 집계 (JS 루프 대신 DB에서 처리)
    const [logsResult, membersResult] = await Promise.all([
      supabase.rpc("get_contribution_stats", { _trip_id: tripId }),
      supabase
        .from("trip_members")
        .select("user_id, role, profile:profiles(id, display_name, avatar_url)")
        .eq("trip_id", tripId),
    ]);

    if (logsResult.error) {
      return errorResponse("INTERNAL_ERROR", "Internal server error");
    }

    // RPC 결과를 Map으로 변환
    const statsMap = new Map<string, { places: number; votes: number; checklist: number; schedule: number; total: number }>();
    for (const row of logsResult.data ?? []) {
      statsMap.set(row.user_id, {
        places: row.places,
        votes: row.votes,
        checklist: row.checklist,
        schedule: row.schedule,
        total: row.total,
      });
    }

    const stats = (membersResult.data ?? []).map((m) => ({
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

    stats.sort((a, b) => b.contributions.total - a.contributions.total);

    return NextResponse.json({ stats });
  },
);
