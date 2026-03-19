import { withAuth } from "@/lib/api/guards";
import { NextResponse } from "next/server";

// PATCH /api/notifications/[id]/read — 단건 읽음 처리
export const PATCH = withAuth(async (request, { supabase, user }) => {
  const id = request.url.match(/\/notifications\/([^/]+)\/read/)?.[1];
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id, is_read, read_at")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(data);
});
