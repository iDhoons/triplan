import { withAuth } from "@/lib/api/guards";
import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api/error-response";

// @TASK T7.7 - URL regex -> Next.js route params
// PATCH /api/notifications/[id]/read — 단건 읽음 처리
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) {
    return errorResponse("BAD_REQUEST", "Missing id");
  }

  const handler = withAuth(async (_request, { supabase, user }) => {
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

  return handler(request);
}
