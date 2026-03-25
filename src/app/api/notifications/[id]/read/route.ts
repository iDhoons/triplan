import { withAuth } from "@/lib/api/guards";
import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api/error-response";

// PATCH /api/notifications/[id]/read — 단건 읽음 처리
export const PATCH = withAuth(async (request, { supabase, user }) => {
  const id = request.url.match(/\/notifications\/([^/]+)\/read/)?.[1];
  if (!id) {
    return errorResponse("BAD_REQUEST", "Missing id");
  }

  const { data, error } = await supabase
    .from("notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id, is_read, read_at")
    .single();

  if (error || !data) {
    return errorResponse("NOT_FOUND", "Notification not found");
  }

  return NextResponse.json(data);
});
