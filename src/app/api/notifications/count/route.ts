import { withAuth } from "@/lib/api/guards";
import { NextResponse } from "next/server";

// GET /api/notifications/count — 안읽은 배지 카운트
export const GET = withAuth(async (_request, { supabase, user }) => {
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("is_read", false);

  if (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ unread_count: count ?? 0 });
});
