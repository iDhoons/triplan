import { createClient } from "@/lib/supabase/server";
import { enrichFromUrl } from "@/lib/google-places";
import { NextResponse } from "next/server";
import { after } from "next/server";

// Rate limiter (in-memory, 프로덕션에서는 Upstash Redis 권장)
const rateLimitMap = new Map<string, { count: number; reset: number }>();
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 10;

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);
  if (!entry || now > entry.reset) {
    rateLimitMap.set(userId, { count: 1, reset: now + WINDOW_MS });
    return true;
  }
  if (entry.count >= MAX_REQUESTS) return false;
  entry.count++;
  return true;
}

/**
 * POST /api/places/share
 * Share Target에서 받은 URL을 즉시 저장하고 비동기 풍부화.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!checkRateLimit(user.id)) {
    return NextResponse.json(
      { error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." },
      { status: 429 }
    );
  }

  let body: { url?: unknown; trip_id?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body.url !== "string" || typeof body.trip_id !== "string") {
    return NextResponse.json(
      { error: "url과 trip_id가 필요합니다" },
      { status: 400 }
    );
  }

  const url = body.url.trim();
  const tripId = body.trip_id.trim();

  // URL 형식 검증
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return NextResponse.json({ error: "HTTP/HTTPS URL만 지원합니다" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "올바른 URL 형식이 아닙니다" }, { status: 400 });
  }

  if (url.length > 2048) {
    return NextResponse.json({ error: "URL이 너무 깁니다" }, { status: 400 });
  }

  // trip 소유자 확인 (Authorization)
  const { data: membership } = await supabase
    .from("trip_members")
    .select("role")
    .eq("trip_id", tripId)
    .eq("user_id", user.id)
    .single();

  if (!membership) {
    return NextResponse.json({ error: "해당 여행에 접근할 수 없습니다" }, { status: 403 });
  }

  // 중복 URL 체크
  const { data: existing } = await supabase
    .from("places")
    .select("id, name")
    .eq("trip_id", tripId)
    .eq("source_url", url)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { duplicate: true, place_id: existing.id, name: existing.name },
      { status: 200 }
    );
  }

  // 즉시 저장 (enriched=false, 이름은 URL에서 추정)
  const { data: place, error: insertErr } = await supabase
    .from("places")
    .insert({
      trip_id: tripId,
      name: "불러오는 중...",
      category: "other" as const,
      source_url: url,
      url: url,
      enriched: false,
      enrich_attempts: 0,
      added_by: user.id,
      image_urls: [],
      amenities: [],
    })
    .select("id")
    .single();

  if (insertErr || !place) {
    console.error("[share] Insert error:", insertErr);
    return NextResponse.json({ error: "저장에 실패했습니다" }, { status: 500 });
  }

  // 비동기 풍부화: after()로 응답 반환 후에도 실행을 보장
  after(async () => {
    await enrichPlaceInBackground(supabase, place.id, url);
  });

  return NextResponse.json(
    { place_id: place.id, enriched: false },
    { status: 201 }
  );
}

/**
 * 백그라운드 풍부화 (fire-and-forget).
 * 실패해도 클라이언트 트리거로 재시도 가능.
 */
async function enrichPlaceInBackground(
  supabase: Awaited<ReturnType<typeof createClient>>,
  placeId: string,
  sourceUrl: string
) {
  try {
    const enriched = await enrichFromUrl(sourceUrl);
    if (!enriched) {
      await supabase
        .from("places")
        .update({
          enrich_attempts: 1,
          enrich_error: "장소 정보를 찾을 수 없습니다",
        })
        .eq("id", placeId);
      return;
    }

    await supabase
      .from("places")
      .update({
        name: enriched.name,
        category: enriched.category,
        address: enriched.address,
        latitude: enriched.latitude,
        longitude: enriched.longitude,
        rating: enriched.rating,
        image_urls: enriched.image_urls,
        memo: enriched.memo,
        opening_hours: enriched.opening_hours,
        google_place_id: enriched.google_place_id,
        phone: enriched.phone,
        website: enriched.website,
        review_count: enriched.review_count,
        price_level: enriched.price_level,
        business_status: enriched.business_status,
        description: enriched.description,
        enriched: true,
        enriched_at: new Date().toISOString(),
        enrich_attempts: 1,
        enrich_error: null,
      })
      .eq("id", placeId);
  } catch (err) {
    console.error("[share] Background enrich error:", err);
    try {
      await supabase
        .from("places")
        .update({
          enrich_attempts: 1,
          enrich_error: err instanceof Error ? err.message : "풍부화 실패",
        })
        .eq("id", placeId);
    } catch {
      // 에러 기록 실패 무시
    }
  }
}
