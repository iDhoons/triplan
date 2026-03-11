import { createClient } from "@/lib/supabase/server";
import { enrichFromUrl } from "@/lib/google-places";
import { NextResponse } from "next/server";

// ─── Rate limiter (in-memory, 프로덕션에서는 Redis 권장) ───
const rateLimitMap = new Map<string, { count: number; reset: number }>();
const WINDOW_MS = 60_000; // 1분
const MAX_REQUESTS = 10; // 분당 10회

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

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limiting
  if (!checkRateLimit(user.id)) {
    return NextResponse.json(
      { error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." },
      { status: 429 }
    );
  }

  let body: { url?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // 런타임 타입 검증
  if (typeof body.url !== "string") {
    return NextResponse.json({ error: "URL must be a string" }, { status: 400 });
  }

  const url = body.url.trim();
  if (!url || url.length > 2048) {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  // URL 형식 + 프로토콜 검증
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return NextResponse.json({ error: "올바른 URL 형식이 아닙니다" }, { status: 400 });
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return NextResponse.json({ error: "HTTP/HTTPS URL만 지원합니다" }, { status: 400 });
  }

  // URL에서 이름 추출 → Places API로 장소 정보 조회
  try {
    const enriched = await enrichFromUrl(url);
    if (enriched) {
      return NextResponse.json({
        name: enriched.name,
        category: enriched.category,
        url,
        address: enriched.address,
        rating: enriched.rating,
        imageUrl: enriched.image_urls[0] ?? null,
        image_urls: enriched.image_urls,
        memo: enriched.memo,
        phone: enriched.phone,
        website: enriched.website,
        review_count: enriched.review_count,
        price_level: enriched.price_level,
        description: enriched.description,
        opening_hours: enriched.opening_hours,
        latitude: enriched.latitude,
        longitude: enriched.longitude,
        google_place_id: enriched.google_place_id,
        business_status: enriched.business_status,
      });
    }
    return NextResponse.json(
      { error: "해당 URL에서 장소 정보를 찾을 수 없습니다" },
      { status: 422 }
    );
  } catch (err) {
    console.error("[scrape] Places API error:", err);
    return NextResponse.json(
      { error: "해당 URL에서 정보를 가져올 수 없습니다" },
      { status: 422 }
    );
  }
}
