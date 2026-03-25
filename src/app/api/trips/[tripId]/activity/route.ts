import { withTripMember } from "@/lib/api/guards";
import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api/error-response";

// GET /api/trips/[tripId]/activity — 최근 활동 타임라인
export const GET = withTripMember(
  (request) => request.url.match(/\/trips\/([^/]+)\/activity/)?.[1] ?? null,
  async (_request, { supabase, tripId }) => {
    const url = new URL(_request.url);
    const cursor = url.searchParams.get("cursor");
    const limit = Math.min(Number(url.searchParams.get("limit")) || 20, 50);

    let query = supabase
      .from("activity_logs")
      .select("*, profile:profiles(id, display_name, avatar_url)")
      .eq("trip_id", tripId)
      .order("created_at", { ascending: false })
      .limit(limit + 1); // +1로 다음 페이지 존재 여부 확인

    if (cursor) {
      query = query.lt("created_at", cursor);
    }

    const { data, error } = await query;

    if (error) {
      return errorResponse("INTERNAL_ERROR", "Internal server error");
    }

    const hasMore = (data?.length ?? 0) > limit;
    const activities = hasMore ? data!.slice(0, limit) : (data ?? []);
    const nextCursor = hasMore
      ? activities[activities.length - 1]?.created_at ?? null
      : null;

    return NextResponse.json({ activities, next_cursor: nextCursor });
  },
);
