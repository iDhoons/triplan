import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/api/guards";
import { errorResponse } from "@/lib/api/error-response";

const INVITE_CODE_PATTERN = /^[a-zA-Z0-9_-]{5,64}$/;

// GET /api/guest/[inviteCode] — 비로그인 게스트용 제한된 여행 데이터
// CEO 결정 (2026-04-08): places + schedules 조회 (checklist 제외), 7일 만료 invite_tokens 우선 검증
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
  if (!(await checkRateLimit("guest-invite", ip, { windowMs: 60_000, maxRequests: 15 }))) {
    return errorResponse("RATE_LIMITED", "Too many requests");
  }

  // Service role 클라이언트 (RLS 우회 — 반환 필드 제한 필수)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  let tripId: string;

  // 1. invite_tokens 테이블 우선 검증 (7일 만료 시스템)
  const { data: inviteToken } = await supabase
    .from("invite_tokens")
    .select("trip_id, expires_at")
    .eq("token", inviteCode)
    .maybeSingle();

  if (inviteToken) {
    if (new Date(inviteToken.expires_at) < new Date()) {
      return errorResponse("NOT_FOUND", "Invite link has expired");
    }
    tripId = inviteToken.trip_id;
  } else {
    // 2. 하위 호환: trips.invite_code (기존 영구 멤버 초대 링크)
    const { data: tripByCode, error: tripError } = await supabase
      .from("trips")
      .select("id")
      .eq("invite_code", inviteCode)
      .maybeSingle();

    if (tripError || !tripByCode) {
      return errorResponse("NOT_FOUND", "Trip not found");
    }
    tripId = tripByCode.id;
  }

  // 여행 기본 정보 조회
  const { data: trip } = await supabase
    .from("trips")
    .select("title, destination, start_date, end_date")
    .eq("id", tripId)
    .single();

  if (!trip) {
    return errorResponse("NOT_FOUND", "Trip not found");
  }

  // 장소 목록 (제한된 필드만 — CEO 결정: places 조회 포함)
  const { data: places } = await supabase
    .from("places")
    .select("id, name, category, image_urls, address, rating")
    .eq("trip_id", tripId)
    .order("created_at", { ascending: true });

  // 일정 요약 (CEO 결정: schedules 조회 포함)
  const { data: schedules } = await supabase
    .from("schedules")
    .select(
      "id, date, schedule_items:schedule_items(id, title, sort_order, place:places(name, category))",
    )
    .eq("trip_id", tripId)
    .order("date", { ascending: true });

  // 멤버 수만 (상세 정보는 제외)
  const { count: memberCount } = await supabase
    .from("trip_members")
    .select("id", { count: "exact", head: true })
    .eq("trip_id", tripId);

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
