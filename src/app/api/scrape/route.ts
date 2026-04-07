import { enrichFromUrl } from "@/lib/google-places";
import { scrapeUrl, ALLOWED_DOMAINS } from "@/lib/scraper";
import { NextResponse } from "next/server";
import { withAuth, checkRateLimit } from "@/lib/api/guards";
import { errorResponse } from "@/lib/api/error-response";

export const POST = withAuth(async (request, { user }) => {
  // Rate limiting (guards.ts 공통 모듈 사용)
  if (!checkRateLimit("scrape", user.id)) {
    return errorResponse("RATE_LIMITED", "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.");
  }

  let body: { url?: unknown };
  try {
    body = await request.json();
  } catch {
    return errorResponse("BAD_REQUEST", "Invalid JSON body");
  }

  // 런타임 타입 검증
  if (typeof body.url !== "string") {
    return errorResponse("BAD_REQUEST", "URL must be a string");
  }

  const url = body.url.trim();
  if (!url || url.length > 2048) {
    return errorResponse("BAD_REQUEST", "Invalid URL");
  }

  // URL 형식 + 프로토콜 검증
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return errorResponse("BAD_REQUEST", "올바른 URL 형식이 아닙니다");
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return errorResponse("BAD_REQUEST", "HTTP/HTTPS URL만 지원합니다");
  }

  // 화이트리스트 도메인이면 HTML 스크래핑 + Places API 머지
  // 그 외 도메인은 Places API만 사용
  try {
    const isAllowed = ALLOWED_DOMAINS.has(parsed.hostname);

    const [scraped, enriched] = await Promise.all([
      isAllowed ? scrapeUrl(url) : Promise.resolve(null),
      enrichFromUrl(url).catch(() => null),
    ]);

    if (!scraped && !enriched) {
      return errorResponse("BAD_REQUEST", "해당 URL에서 장소 정보를 찾을 수 없습니다");
    }

    // 머지: HTML 스크래핑 우선, 빈 필드는 Places API로 채움
    return NextResponse.json({
      name: scraped?.name ?? enriched?.name ?? null,
      category: scraped?.category ?? enriched?.category ?? "other",
      url,
      address: scraped?.address ?? enriched?.address ?? null,
      rating: scraped?.rating ?? enriched?.rating ?? null,
      imageUrl: (scraped?.image_urls[0] ?? enriched?.image_urls[0]) ?? null,
      image_urls: scraped?.image_urls.length
        ? scraped.image_urls
        : (enriched?.image_urls ?? []),
      memo: scraped?.memo ?? enriched?.memo ?? null,
      phone: scraped?.phone ?? enriched?.phone ?? null,
      website: scraped?.website ?? enriched?.website ?? null,
      review_count: scraped?.review_count ?? enriched?.review_count ?? null,
      price_level: enriched?.price_level ?? null,
      price_range: scraped?.price_range ?? null,
      description: scraped?.description ?? enriched?.description ?? null,
      opening_hours: enriched?.opening_hours ?? null,
      latitude: enriched?.latitude ?? null,
      longitude: enriched?.longitude ?? null,
      google_place_id: enriched?.google_place_id ?? null,
      business_status: enriched?.business_status ?? null,
      amenities: scraped?.amenities ?? [],
      cancel_policy: scraped?.cancel_policy ?? null,
      check_in_time: scraped?.check_in_time ?? null,
      check_out_time: scraped?.check_out_time ?? null,
      price_per_night: scraped?.price_per_night ?? null,
    });
  } catch (err) {
    console.error({ action: "scrape", error: err, context: { url } });
    return errorResponse("INTERNAL_ERROR", "해당 URL에서 정보를 가져올 수 없습니다");
  }
});
