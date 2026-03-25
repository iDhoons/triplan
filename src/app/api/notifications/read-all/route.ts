import { withAuth } from "@/lib/api/guards";
import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api/error-response";

// PATCH /api/notifications/read-all — 전체 읽음 처리
export const PATCH = withAuth(async (_request, { supabase, user }) => {
  const { data, error } = await supabase
    .from("notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("is_read", false)
    .select("id");

  if (error) {
    return errorResponse("INTERNAL_ERROR", "Internal server error");
  }

  return NextResponse.json({ updated_count: data?.length ?? 0 });
});
