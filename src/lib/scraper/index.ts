/**
 * HTML 스크래퍼 — 화이트리스트 도메인에서 장소 메타데이터를 추출한다.
 * 사이트별 파서 우선, 범용 파서 폴백.
 * Places API 의존 없이 순수 HTML 파싱만 수행.
 */

import type { PlaceCategory } from "@/types/database";

// ─── 공개 인터페이스 ──────────────────────────────────────────────────────────

export interface ScrapedPlace {
  name: string | null;
  category: PlaceCategory;
  address: string | null;
  phone: string | null;
  website: string | null;
  rating: number | null;
  review_count: number | null;
  price_per_night: number | null;
  price_range: string | null;
  image_urls: string[];
  amenities: string[];
  cancel_policy: string | null;
  check_in_time: string | null;
  check_out_time: string | null;
  memo: string | null;
  description: string | null;
}

// ─── 도메인 화이트리스트 ─────────────────────────────────────────────────────

const ALLOWED_DOMAINS = new Set([
  "booking.com", "www.booking.com", "m.booking.com",
  "agoda.com", "www.agoda.com",
  "tripadvisor.com", "www.tripadvisor.com",
  "trip.com", "www.trip.com",
  "hotels.com", "www.hotels.com",
  "airbnb.com", "www.airbnb.com",
  "expedia.com", "www.expedia.com",
  "klook.com", "www.klook.com",
  "traveloka.com", "www.traveloka.com",
  "naver.me", "map.naver.com", "m.place.naver.com", "pcmap.place.naver.com",
  "map.kakao.com", "place.map.kakao.com",
  "google.com", "www.google.com", "google.co.kr",
  "maps.app.goo.gl", "goo.gl",
]);

type SiteName =
  | "booking"
  | "agoda"
  | "tripadvisor"
  | "airbnb"
  | "naver-map"
  | "kakao-map"
  | "google-maps"
  | "generic";

// ─── 유틸리티 ────────────────────────────────────────────────────────────────

function getMeta(html: string, name: string): string | null {
  const re = new RegExp(
    `<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']+)["']|` +
      `<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${name}["']`,
    "i"
  );
  const m = html.match(re);
  return m ? (m[1] ?? m[2] ?? null) : null;
}

function extractPrice(text: string): number | null {
  const m = text.replace(/[,\s]/g, "").match(/[\d.]+/);
  return m ? Number(m[0]) : null;
}

function parseJsonLds(html: string): Record<string, unknown>[] {
  const results: Record<string, unknown>[] = [];
  const re =
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = re.exec(html)) !== null) {
    try {
      const parsed: unknown = JSON.parse(match[1]);
      if (Array.isArray(parsed)) {
        results.push(...(parsed as Record<string, unknown>[]));
      } else if (typeof parsed === "object" && parsed !== null) {
        results.push(parsed as Record<string, unknown>);
      }
    } catch {
      // malformed JSON-LD 무시
    }
  }
  return results;
}

// ─── 범용 파서 ───────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function parseGeneric(html: string, _url: string): ScrapedPlace {
  const jsonLds = parseJsonLds(html);

  let name = getMeta(html, "og:title") ?? getMeta(html, "title");
  let address: string | null = null;
  let phone: string | null = null;
  let website: string | null = null;
  let rating: number | null = null;
  let reviewCount: number | null = null;
  let priceRange: string | null = null;
  let description: string | null =
    getMeta(html, "og:description") ?? getMeta(html, "description");
  const imageUrls: string[] = [];
  const amenities: string[] = [];
  let category: PlaceCategory = "other";

  const ogImage = getMeta(html, "og:image");
  if (ogImage) imageUrls.push(ogImage);

  for (const ld of jsonLds) {
    if (!name && ld["name"]) name = String(ld["name"]);

    const addr = ld["address"] as Record<string, unknown> | string | undefined;
    if (!address && addr) {
      address =
        typeof addr === "string"
          ? addr
          : [
              addr["streetAddress"],
              addr["addressLocality"],
              addr["addressRegion"],
              addr["addressCountry"],
            ]
              .filter(Boolean)
              .join(", ") || null;
    }

    if (!phone && ld["telephone"]) phone = String(ld["telephone"]);
    if (!website && ld["url"]) website = String(ld["url"]);
    if (!website && Array.isArray(ld["sameAs"])) {
      website = (ld["sameAs"] as string[])[0] ?? null;
    }

    const agg = ld["aggregateRating"] as Record<string, unknown> | undefined;
    if (!rating && agg?.["ratingValue"])
      rating = Number(agg["ratingValue"]) || null;
    if (!reviewCount && agg?.["reviewCount"])
      reviewCount = Number(agg["reviewCount"]) || null;
    if (!reviewCount && agg?.["ratingCount"])
      reviewCount = Number(agg["ratingCount"]) || null;

    const amenityFeature = ld["amenityFeature"] as
      | Array<Record<string, string>>
      | undefined;
    if (Array.isArray(amenityFeature) && amenities.length === 0) {
      for (const af of amenityFeature) {
        const n = af["name"] ?? af["value"];
        if (n) amenities.push(String(n));
      }
    }

    if (!priceRange && ld["priceRange"]) priceRange = String(ld["priceRange"]);
    if (!description && ld["description"])
      description = String(ld["description"]);

    if (Array.isArray(ld["image"])) {
      for (const img of ld["image"] as unknown[]) {
        const src =
          typeof img === "string"
            ? img
            : (img as Record<string, string>)?.["url"];
        if (src && !imageUrls.includes(src)) imageUrls.push(src);
      }
    }

    const ldType = String(ld["@type"] ?? "").toLowerCase();
    if (ldType.includes("hotel") || ldType.includes("lodging"))
      category = "accommodation";
    else if (
      ldType.includes("restaurant") ||
      ldType.includes("foodestablishment")
    )
      category = "restaurant";
    else if (
      ldType.includes("attraction") ||
      ldType.includes("tourist") ||
      ldType.includes("museum")
    )
      category = "attraction";
  }

  // 전화번호 폴백
  if (!phone) {
    const telMatch = html.match(/<a[^>]+href=["']tel:([^"']+)["']/i);
    if (telMatch) phone = telMatch[1].trim();
  }
  if (!phone) phone = getMeta(html, "telephone");

  return {
    name,
    category,
    address,
    phone,
    website,
    rating,
    review_count: reviewCount,
    price_per_night: null,
    price_range: priceRange,
    image_urls: imageUrls.slice(0, 8),
    amenities,
    cancel_policy: null,
    check_in_time: null,
    check_out_time: null,
    memo: null,
    description,
  };
}

// ─── 사이트별 파서 ───────────────────────────────────────────────────────────

function parseBooking(html: string, url: string): ScrapedPlace {
  const base = parseGeneric(html, url);

  if (base.name)
    base.name = base.name.replace(/\s*[-–|]\s*Booking\.com.*$/i, "").trim();

  const priceStr = getMeta(html, "booking_com:price");
  if (priceStr)
    base.price_per_night = extractPrice(priceStr) ?? base.price_per_night;

  const ratingStr = getMeta(html, "booking_com:rating");
  if (ratingStr) base.rating = Number(ratingStr) || base.rating;

  const reviewStr = getMeta(html, "booking_com:reviews_count");
  if (reviewStr)
    base.review_count =
      Number(reviewStr.replace(/[,\s]/g, "")) || base.review_count;

  const facilitiesMatch = html.match(
    /data-testid=["']property-most-popular-facilities["'][^>]*>([\s\S]*?)<\/div>/i
  );
  if (facilitiesMatch && base.amenities.length === 0) {
    const items = facilitiesMatch[1].match(/>([^<]{2,50})</g);
    if (items) {
      base.amenities = items
        .map((i) => i.replace(/^>/, "").trim())
        .filter((a) => a.length > 1 && a.length < 50);
    }
  }

  const cancelMatch = html.match(
    /(?:cancellation|free_cancellation)[^>]*>([^<]+)</i
  );
  if (cancelMatch) base.cancel_policy = cancelMatch[1].trim();

  base.category = "accommodation";
  return base;
}

function parseAgoda(html: string, url: string): ScrapedPlace {
  const base = parseGeneric(html, url);

  if (base.name)
    base.name = base.name.replace(/\s*[-–|]\s*Agoda.*$/i, "").trim();

  const desc = getMeta(html, "og:description");
  if (desc) {
    const priceMatch = desc.match(/(?:₩|KRW|원)\s?[\d,]+/);
    if (priceMatch)
      base.price_per_night = extractPrice(priceMatch[0]) ?? base.price_per_night;

    const discountMatch = desc.match(/(\d+%\s*할인|\d+%\s*OFF)/i);
    if (discountMatch) {
      base.memo = base.memo
        ? `${base.memo}\n할인: ${discountMatch[1]}`
        : `할인: ${discountMatch[1]}`;
    }

    if (!base.review_count) {
      const reviewMatch = desc.match(/리뷰\s*([\d,]+)\s*개/);
      if (reviewMatch)
        base.review_count =
          Number(reviewMatch[1].replace(/,/g, "")) || null;
    }
  }

  base.category = "accommodation";
  return base;
}

function parseNaverMap(html: string, url: string): ScrapedPlace {
  const base = parseGeneric(html, url);

  if (base.name) {
    base.name = base.name
      .replace(/\s*[-–:]\s*네이버.*$/i, "")
      .replace(/\s*[-–:]\s*NAVER.*$/i, "")
      .trim();
  }

  const placeType = getMeta(html, "place:type");
  if (placeType) {
    if (placeType.includes("음식점") || placeType.includes("카페"))
      base.category = "restaurant";
    else if (placeType.includes("숙박")) base.category = "accommodation";
    else if (placeType.includes("관광") || placeType.includes("명소"))
      base.category = "attraction";
  }

  const phone = getMeta(html, "place:phone");
  if (phone && !base.phone) base.phone = phone;

  const addr = getMeta(html, "place:location:address");
  if (addr && !base.address) base.address = addr;

  return base;
}

function parseKakaoMap(html: string, url: string): ScrapedPlace {
  const base = parseGeneric(html, url);

  if (base.name) {
    base.name = base.name
      .replace(/\s*[-–|]\s*카카오맵.*$/i, "")
      .replace(/\s*[-–|]\s*Kakao.*$/i, "")
      .trim();
  }

  const desc = getMeta(html, "og:description");
  if (desc) {
    const addrMatch = desc.match(/주소[:\s]+([^,|]+)/);
    if (addrMatch && !base.address) base.address = addrMatch[1].trim();

    const phoneMatch = desc.match(/전화[:\s]+([\d-]+)/);
    if (phoneMatch && !base.phone) base.phone = phoneMatch[1].trim();
  }

  return base;
}

function parseGoogleMaps(html: string, url: string): ScrapedPlace {
  const base = parseGeneric(html, url);

  if (base.name) {
    base.name = base.name
      .replace(/\s*[-–]\s*Google Maps.*$/i, "")
      .replace(/\s*[-–]\s*Google 지도.*$/i, "")
      .trim();
  }

  return base;
}

// ─── 사이트 감지 ─────────────────────────────────────────────────────────────

function detectSite(hostname: string): SiteName {
  if (/booking\.com/i.test(hostname)) return "booking";
  if (/agoda\.com/i.test(hostname)) return "agoda";
  if (/tripadvisor/i.test(hostname)) return "tripadvisor";
  if (/airbnb\.com/i.test(hostname)) return "airbnb";
  if (/naver\.(me|com)/i.test(hostname)) return "naver-map";
  if (/kakao\.com/i.test(hostname)) return "kakao-map";
  if (/google\.(com|co\.\w+)/i.test(hostname) || /goo\.gl/i.test(hostname))
    return "google-maps";
  return "generic";
}

// ─── 공개 API ────────────────────────────────────────────────────────────────

/**
 * 주어진 URL의 HTML을 fetch하여 ScrapedPlace를 반환한다.
 * 화이트리스트 도메인만 허용. 실패 시 null 반환.
 */
export async function scrapeUrl(url: string): Promise<ScrapedPlace | null> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  if (!ALLOWED_DOMAINS.has(parsed.hostname)) return null;

  let html: string;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; triplan-bot/1.0; +https://triplan.app)",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
      },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    html = await res.text();
  } catch {
    return null;
  }

  const site = detectSite(parsed.hostname);
  switch (site) {
    case "booking":
      return parseBooking(html, url);
    case "agoda":
      return parseAgoda(html, url);
    case "naver-map":
      return parseNaverMap(html, url);
    case "kakao-map":
      return parseKakaoMap(html, url);
    case "google-maps":
      return parseGoogleMaps(html, url);
    default:
      return parseGeneric(html, url);
  }
}

export { ALLOWED_DOMAINS };
