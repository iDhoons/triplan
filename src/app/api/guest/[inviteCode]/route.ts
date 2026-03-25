import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/api/guards";
import { errorResponse } from "@/lib/api/error-response";

const INVITE_CODE_PATTERN = /^[a-zA-Z0-9_-]{5,64}$/;

// GET /api/guest/[inviteCode] — 비로그인 게스트용 제한된 여행 데이터
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ inviteCode: string }> },
) {
  const { inviteCode } = await params;

  if (!inviteCode || !INVITE_CODE_PATTERN.test(inviteCode)) {
    return errorResponse("BAD_REQUEST", "Invalid invite code");
  }

  // IP 기반 rate limiting (열거 공격 방어)
  const forwarded = _request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() ?? "unknown";
  if (!checkRateLimit("guest-invite", ip, { windowMs: 60_000, maxRequests: 15 })) {
    return errorResponse("RATE_LIMITED", "Too many requests");
  }

  // Service role 클라이언트 (RLS 우회 — 반환 필드 제한 필수)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // 여행 기본 정보 조회
  const { data: trip, error: tripError } = await supabase
    .from("trips")
    .select("id, title, destination, start_date, end_date")
    .eq("invite_code", inviteCode)
    .single();

  if (tripError || !trip) {
    return errorResponse("NOT_FOUND", "Trip not found");
  }

  // 장소 목록 (제한된 필드만)
  const { data: places } = await supabase
    .from("places")
    .select("id, name, category, image_urls, address, rating")
    .eq("trip_id", trip.id)
    .order("created_at", { ascending: true });

  // 일정 요약 (날짜별 장소 이름만)
  const { data: schedules } = await supabase
    .from("schedules")
    .select(
      "id, date, schedule_items:schedule_items(id, title, sort_order, place:places(name, category))",
    )
    .eq("trip_id", trip.id)
    .order("date", { ascending: true });

  // 멤버 수만 (상세 정보는 제외)
  const { count: memberCount } = await supabase
    .from("trip_members")
    .select("id", { count: "exact", head: true })
    .eq("trip_id", trip.id);

  return NextResponse.json({
    trip: {
      title: trip.title,
      destination: trip.destination,
      start_date: trip.start_date,
      end_date: trip.end_date,
    },
    places: (places ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      image_url: p.image_urls?.[0] ?? null,
      address: p.address,
      rating: p.rating,
    })),
    schedules: (schedules ?? []).map((s) => {
      const items = (s.schedule_items ?? []) as Array<Record<string, unknown>>;
      return {
        date: s.date,
        items: items
          .sort((a, b) => (a.sort_order as number) - (b.sort_order as number))
          .map((item) => {
            const place = item.place as { name: string; category: string } | null;
            return {
              title: place?.name ?? (item.title as string),
              category: place?.category ?? null,
            };
          }),
      };
    }),
    member_count: memberCount ?? 0,
  });
}
