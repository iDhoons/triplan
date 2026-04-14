import { withAuth } from "@/lib/api/guards";
import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api/error-response";
import { z } from "zod";
import webpush from "web-push";

let vapidInitialized = false;

/**
 * web-push는 모듈 평가 시점이 아니라 첫 호출 시점에 초기화한다.
 * 빌드 타임 page data 수집 단계에서 환경변수가 없어도 빌드가 실패하지
 * 않도록 하기 위함. 환경변수 누락 시 false를 반환하고 핸들러에서 503을 낸다.
 */
function configureVapid(): boolean {
  if (vapidInitialized) return true;

  const subject = process.env.VAPID_SUBJECT;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;

  if (!subject || !publicKey || !privateKey) {
    return false;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidInitialized = true;
  return true;
}

const SendSchema = z.object({
  user_id: z.string().uuid(),
  title: z.string().min(1),
  body: z.string().min(1),
  url: z.string().optional().default("/"),
});

// POST /api/notifications/send — 특정 사용자에게 Push 발송
// 서버 내부 또는 관리자만 호출 (user_id 검증은 RLS로 보호)
export const POST = withAuth(async (request, { supabase, user }) => {
  if (!configureVapid()) {
    return errorResponse(
      "INTERNAL_ERROR",
      "Push notifications are not configured on this deployment"
    );
  }

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

  if (user_id !== user.id) {
    return errorResponse("FORBIDDEN", "자신에게만 알림을 보낼 수 있습니다");
  }

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
