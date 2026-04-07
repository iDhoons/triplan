import { withAuth } from "@/lib/api/guards";
import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api/error-response";
import { z } from "zod";

const SubscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

// POST /api/notifications/subscribe — Push 구독 등록
export const POST = withAuth(async (request, { supabase, user }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("BAD_REQUEST", "Invalid JSON");
  }

  const parsed = SubscribeSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse("BAD_REQUEST", parsed.error.issues[0]?.message ?? "Invalid body");
  }

  const { endpoint, keys } = parsed.data;

  const { error } = await supabase
    .from("notification_subscriptions")
    .upsert(
      {
        user_id: user.id,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
      },
      { onConflict: "user_id,endpoint" }
    );

  if (error) {
    console.error({ action: "push_subscribe", error, context: { userId: user.id } });
    return errorResponse("INTERNAL_ERROR", "Failed to save subscription");
  }

  return NextResponse.json({ ok: true }, { status: 201 });
});

// DELETE /api/notifications/subscribe — Push 구독 해제
export const DELETE = withAuth(async (request, { supabase, user }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("BAD_REQUEST", "Invalid JSON");
  }

  const parsed = z.object({ endpoint: z.string().url() }).safeParse(body);
  if (!parsed.success) {
    return errorResponse("BAD_REQUEST", "Missing endpoint");
  }

  const { error } = await supabase
    .from("notification_subscriptions")
    .delete()
    .eq("user_id", user.id)
    .eq("endpoint", parsed.data.endpoint);

  if (error) {
    console.error({ action: "push_unsubscribe", error, context: { userId: user.id } });
    return errorResponse("INTERNAL_ERROR", "Failed to remove subscription");
  }

  return NextResponse.json({ ok: true });
});
