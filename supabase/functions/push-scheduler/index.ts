/**
 * push-scheduler Edge Function
 * 매분 실행 (Supabase Dashboard > Edge Functions > Cron 설정 필요)
 * 스케줄: * * * * * (매분)
 *
 * 동작:
 * 1. 출발 알림이 필요한 schedule_items 조회
 *    조건: arrival_by IS NOT NULL
 *       AND travel_duration_seconds IS NOT NULL
 *       AND notify_before_minutes > 0
 *       AND 출발 예정 시각이 [now, now+1분] 구간에 있음
 * 2. 해당 사용자의 Push 구독 조회
 * 3. Web Push 발송
 */

import webpush from "npm:web-push@3.6.7";

const VAPID_PUBLIC_KEY = Deno.env.get("NEXT_PUBLIC_VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@triplan.app";
const SUPABASE_URL = Deno.env.get("NEXT_PUBLIC_SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

Deno.serve(async () => {
  try {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + 60_000); // 1분 윈도우

    // 출발 예정 schedule_items 조회 (서비스 롤 키 필요)
    const itemsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/rpc/get_due_departure_items`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          window_start: now.toISOString(),
          window_end: windowEnd.toISOString(),
        }),
      }
    );

    if (!itemsRes.ok) {
      const msg = await itemsRes.text();
      console.error("get_due_departure_items failed:", msg);
      return new Response(JSON.stringify({ error: msg }), { status: 500 });
    }

    type DepartureItem = {
      schedule_item_id: string;
      user_id: string;
      title: string;
      arrival_by: string;
      travel_duration_seconds: number;
      trip_id: string;
      schedule_date: string;
    };

    const items: DepartureItem[] = await itemsRes.json();
    if (!items.length) {
      return new Response(JSON.stringify({ sent: 0 }), { status: 200 });
    }

    // 대상 사용자별 구독 한 번에 조회
    const userIds = [...new Set(items.map((i) => i.user_id))];
    const subsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/notification_subscriptions?user_id=in.(${userIds.join(",")})`,
      {
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
      }
    );

    type SubRow = { user_id: string; endpoint: string; p256dh: string; auth: string };
    const subs: SubRow[] = subsRes.ok ? await subsRes.json() : [];

    const subsByUser = new Map<string, SubRow[]>();
    for (const sub of subs) {
      if (!subsByUser.has(sub.user_id)) subsByUser.set(sub.user_id, []);
      subsByUser.get(sub.user_id)!.push(sub);
    }

    let sent = 0;
    const expiredEndpoints: string[] = [];

    for (const item of items) {
      const userSubs = subsByUser.get(item.user_id) ?? [];
      const arrivalTime = new Date(item.arrival_by).toLocaleTimeString("ko-KR", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      const payload = JSON.stringify({
        title: "출발 알림",
        body: `${item.title}에 ${arrivalTime}까지 도착하려면 지금 출발하세요!`,
        url: `/trips/${item.trip_id}/schedule?date=${item.schedule_date}`,
      });

      const results = await Promise.allSettled(
        userSubs.map((sub) =>
          webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload
          )
        )
      );

      results.forEach((r, idx) => {
        if (r.status === "fulfilled") {
          sent++;
        } else {
          const err = r.reason as { statusCode?: number };
          if (err?.statusCode === 410) expiredEndpoints.push(userSubs[idx]!.endpoint);
          else console.error("push failed:", r.reason);
        }
      });
    }

    // 만료 구독 정리
    if (expiredEndpoints.length > 0) {
      await fetch(
        `${SUPABASE_URL}/rest/v1/notification_subscriptions?endpoint=in.(${expiredEndpoints.map(encodeURIComponent).join(",")})`,
        {
          method: "DELETE",
          headers: {
            apikey: SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
        }
      );
    }

    return new Response(JSON.stringify({ sent, items: items.length }), { status: 200 });
  } catch (err) {
    console.error("push-scheduler error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
