import { withAuth } from "@/lib/api/guards";
import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api/error-response";
import { z } from "zod";
import webpush from "web-push";

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

const SendSchema = z.object({
  user_id: z.string().uuid(),
  title: z.string().min(1),
  body: z.string().min(1),
  url: z.string().optional().default("/"),
});

// POST /api/notifications/send — 특정 사용자에게 Push 발송
// 서버 내부 또는 관리자만 호출 (user_id 검증은 RLS로 보호)
export const POST = withAuth(async (request, { supabase }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("BAD_REQUEST", "Invalid JSON");
  }

  const parsed = SendSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse("BAD_REQUEST", parsed.error.issues[0]?.message ?? "Invalid body");
  }

  const { user_id, title, body: msgBody, url } = parsed.data;

  const { data: subscriptions, error: fetchError } = await supabase
    .from("notification_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", user_id);

  if (fetchError) {
    console.error({ action: "push_send_fetch", error: fetchError, context: { user_id } });
    return errorResponse("INTERNAL_ERROR", "Failed to fetch subscriptions");
  }

  if (!subscriptions || subscriptions.length === 0) {
    return NextResponse.json({ sent: 0 });
  }

  const payload = JSON.stringify({ title, body: msgBody, url });
  const results = await Promise.allSettled(
    subscriptions.map((sub) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      )
    )
  );

  // 만료된 구독(410) 자동 삭제
  const expiredEndpoints: string[] = [];
  results.forEach((result, idx) => {
    if (result.status === "rejected") {
      const err = result.reason as { statusCode?: number };
      if (err?.statusCode === 410) {
        expiredEndpoints.push(subscriptions[idx]!.endpoint);
      } else {
        console.error({ action: "push_send", error: result.reason, context: { user_id } });
      }
    }
  });

  if (expiredEndpoints.length > 0) {
    await supabase
      .from("notification_subscriptions")
      .delete()
      .eq("user_id", user_id)
      .in("endpoint", expiredEndpoints);
  }

  const sent = results.filter((r) => r.status === "fulfilled").length;
  return NextResponse.json({ sent });
});
