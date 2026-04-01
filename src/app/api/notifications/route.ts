import { withAuth } from "@/lib/api/guards";
import { NextResponse } from "next/server";
import { errorResponse, ISO_DATE } from "@/lib/api/error-response";

// GET /api/notifications — 알림 목록 (커서 페이지네이션)
export const GET = withAuth(async (request, { supabase, user }) => {
  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor");
  const limit = Math.min(Number(url.searchParams.get("limit")) || 20, 50);
  const unreadOnly = url.searchParams.get("unread_only") === "true";

  if (cursor && !ISO_DATE.test(cursor)) {
    return errorResponse("BAD_REQUEST", "Invalid cursor format");
  }

  let query = supabase
    .from("notifications")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit + 1);

  if (unreadOnly) {
    query = query.eq("is_read", false);
  }

  if (cursor) {
    query = query.lt("created_at", cursor);
  }

  const { data, error } = await query;

  if (error) {
    return errorResponse("INTERNAL_ERROR", "Internal server error");
  }

  const hasMore = (data?.length ?? 0) > limit;
  const notifications = hasMore ? data!.slice(0, limit) : (data ?? []);
  const nextCursor = hasMore
    ? notifications[notifications.length - 1]?.created_at ?? null
    : null;

  // 안읽은 수도 함께 반환
  const { count: unreadCount } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("is_read", false);

  return NextResponse.json({
    notifications,
    next_cursor: nextCursor,
    unread_count: unreadCount ?? 0,
  });
});
