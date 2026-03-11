import { createClient } from "@/lib/supabase/server";
import { scrapeUrl, isAllowedDomain } from "@/lib/scraper";
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

  // 화이트리스트 도메인이면 HTML 스크래핑, 아니면 Places API 폴백으로 처리
  const isWhitelisted = isAllowedDomain(url);

  if (!isWhitelisted) {
    // 화이트리스트 외 도메인 → Places API 폴백만 사용
    try {
      const { enrichFromUrl } = await import("@/lib/google-places");
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
          price_per_night: null,
          cancel_policy: null,
          amenities: [],
          check_in_time: null,
          check_out_time: null,
          memo: enriched.memo,
          phone: enriched.phone,
          website: enriched.website,
          review_count: enriched.review_count,
          price_level: enriched.price_level,
          price_range: null,
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
      console.error("[scrape] Places API error for non-whitelisted URL:", err);
      return NextResponse.json(
        { error: "해당 URL에서 정보를 가져올 수 없습니다" },
        { status: 422 }
      );
    }
  }

  try {
    const scraped = await scrapeUrl(url);
    console.log("[scrape] HTML result:", { name: scraped.name, address: scraped.address, imageUrl: scraped.imageUrl?.substring(0, 50) });

    // HTML 스크래핑 성공 후 Places API로 추가 정보 보강 (좌표, 전화 등)
    let enriched: Awaited<ReturnType<typeof import("@/lib/google-places").enrichFromUrl>> = null;
    try {
      const { enrichFromUrl } = await import("@/lib/google-places");
      enriched = await enrichFromUrl(url);
      console.log("[scrape] Places enrichment:", { name: enriched?.name, address: enriched?.address });
    } catch (enrichErr) {
      console.error("[scrape] Places enrichment failed:", enrichErr);
      // Places API 실패해도 스크래핑 결과는 반환
    }

    // 머지: 스크래핑 우선, 빈 필드만 Places API로 채움
    const finalName = scraped.name ?? enriched?.name ?? null;
    console.log("[scrape] Final merged name:", finalName);
    return NextResponse.json({
      ...scraped,
      name: finalName,
      category: scraped.category ?? enriched?.category ?? null,
      address: scraped.address ?? enriched?.address ?? null,
      rating: scraped.rating ?? enriched?.rating ?? null,
      imageUrl: scraped.imageUrl ?? enriched?.image_urls[0] ?? null,
      image_urls: scraped.image_urls.length > 0
        ? scraped.image_urls
        : (enriched?.image_urls ?? []),
      phone: scraped.phone ?? enriched?.phone ?? null,
      website: scraped.website ?? enriched?.website ?? null,
      review_count: scraped.review_count ?? enriched?.review_count ?? null,
      description: scraped.description ?? enriched?.description ?? null,
      price_level: enriched?.price_level ?? null,
      price_range: scraped.price_range ?? null,
      latitude: enriched?.latitude ?? null,
      longitude: enriched?.longitude ?? null,
      opening_hours: enriched?.opening_hours ?? null,
      google_place_id: enriched?.google_place_id ?? null,
      business_status: enriched?.business_status ?? null,
    });
  } catch (err) {
    console.error("[scrape] HTML scrape failed, trying Places API fallback:", err);

    // Places API 폴백: HTML 스크래핑 실패 시 Google Places로 보강
    try {
      const { enrichFromUrl } = await import("@/lib/google-places");
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
          price_per_night: null,
          cancel_policy: null,
          amenities: [],
          check_in_time: null,
          check_out_time: null,
          memo: enriched.memo,
          phone: enriched.phone,
          website: enriched.website,
          review_count: enriched.review_count,
          price_level: enriched.price_level,
          price_range: null,
          description: enriched.description,
          opening_hours: enriched.opening_hours,
          latitude: enriched.latitude,
          longitude: enriched.longitude,
          google_place_id: enriched.google_place_id,
          business_status: enriched.business_status,
        });
      }
    } catch (placesErr) {
      console.error("[scrape] Places API fallback also failed:", placesErr);
    }

    return NextResponse.json(
      { error: "해당 URL에서 정보를 가져올 수 없습니다" },
      { status: 422 }
    );
  }
}
