import { lookup } from "node:dns/promises";
import type { PlaceCategory } from "@/types/database";

export interface ScrapedPlace {
  name: string;
  category: PlaceCategory;
  url: string;
  address: string | null;
  rating: number | null;
  imageUrl: string | null;
  image_urls: string[];
  price_per_night: number | null;
  cancel_policy: string | null;
  amenities: string[];
  check_in_time: string | null;
  check_out_time: string | null;
  memo: string | null;
  phone: string | null;
  website: string | null;
  review_count: number | null;
  price_range: string | null;
  description: string | null;
}

// ─── Security: SSRF protection ─────────────────────────
const ALLOWED_PROTOCOLS = new Set(["https:", "http:"]);

const ALLOWED_DOMAINS = [
  "booking.com",
  "agoda.com",
  "agoda.net",
  "yanolja.com",
  "goodchoice.kr",
  "yeogi.com",
  "airbnb.com",
  "airbnb.co.kr",
  "trip.com",
  "expedia.com",
  "expedia.co.kr",
  "hotels.com",
  // 지도 서비스
  "naver.me",
  "map.naver.com",
  "m.place.naver.com",
  "pcmap.place.naver.com",
  "place.naver.com",
  "map.kakao.com",
  "place.map.kakao.com",
  "google.com",
  "google.co.kr",
  "maps.app.goo.gl",
  "goo.gl",
];

const PRIVATE_IP_RANGES = [
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^127\./,
  /^0\./,
  /^fc00:/i,
  /^fe80:/i,
  /^::1$/,
];

export function isAllowedDomain(url: string): boolean {
  const hostname = new URL(url).hostname.toLowerCase();
  return ALLOWED_DOMAINS.some(
    (domain) => hostname === domain || hostname.endsWith("." + domain)
  );
}

async function validateUrlSecurity(url: string): Promise<void> {
  const parsed = new URL(url);

  // 프로토콜 제한
  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    throw new Error("Only HTTP/HTTPS URLs are allowed");
  }

  // 도메인 화이트리스트
  if (!isAllowedDomain(url)) {
    throw new Error("지원하지 않는 사이트입니다");
  }

  // DNS 해석 후 사설 IP 대역 차단
  try {
    const { address } = await lookup(parsed.hostname);
    if (PRIVATE_IP_RANGES.some((re) => re.test(address))) {
      throw new Error("URL resolves to a private IP address");
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes("private")) throw err;
    if (err instanceof Error && err.message.includes("지원하지")) throw err;
    throw new Error("Failed to resolve hostname");
  }
}

const MAX_BODY_SIZE = 5 * 1024 * 1024; // 5MB

async function fetchWithSizeLimit(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "TravelPlannerBot/1.0 (hotel-metadata-scraper)",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
    },
    signal: AbortSignal.timeout(8000),
    redirect: "manual",
  });

  // 리다이렉트 처리: Location 헤더도 SSRF 검증
  if ([301, 302, 303, 307, 308].includes(response.status)) {
    const location = response.headers.get("location");
    if (!location) throw new Error("Redirect without location");
    const redirectUrl = new URL(location, url).toString();
    await validateUrlSecurity(redirectUrl);
    // 1회만 리다이렉트 허용
    const redirectResponse = await fetch(redirectUrl, {
      headers: {
        "User-Agent": "TravelPlannerBot/1.0 (hotel-metadata-scraper)",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
      },
      signal: AbortSignal.timeout(8000),
      redirect: "error",
    });
    if (!redirectResponse.ok) {
      throw new Error("Failed to fetch URL");
    }
    return readResponseBody(redirectResponse);
  }

  if (!response.ok) {
    throw new Error("Failed to fetch URL");
  }

  return readResponseBody(response);
}

async function readResponseBody(response: Response): Promise<string> {
  // Content-Type 검사: HTML만 허용
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
    throw new Error("Response is not HTML");
  }

  // Content-Length 사전 검사
  const contentLength = response.headers.get("content-length");
  if (contentLength && Number(contentLength) > MAX_BODY_SIZE) {
    throw new Error("Response too large");
  }

  // 스트리밍으로 크기 제한 적용
  if (!response.body) throw new Error("Empty response");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalSize = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    totalSize += value.byteLength;
    if (totalSize > MAX_BODY_SIZE) {
      reader.cancel();
      throw new Error("Response body exceeds size limit");
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

// ─── Site detection ────────────────────────────────────
type SiteName =
  | "booking"
  | "agoda"
  | "yanolja"
  | "goodchoice"
  | "airbnb"
  | "trip"
  | "expedia"
  | "hotels"
  | "naver-map"
  | "kakao-map"
  | "google-maps"
  | "generic";

function detectSite(url: string): SiteName {
  const host = new URL(url).hostname.toLowerCase();
  if (host.includes("booking.com")) return "booking";
  if (host.includes("agoda")) return "agoda";
  if (host.includes("yanolja")) return "yanolja";
  if (host.includes("goodchoice") || host.includes("yeogi")) return "goodchoice";
  if (host.includes("airbnb")) return "airbnb";
  if (host.includes("trip.com")) return "trip";
  if (host.includes("expedia")) return "expedia";
  if (host.includes("hotels.com")) return "hotels";
  if (host.includes("naver") && (host.includes("map") || host.includes("place"))) return "naver-map";
  if (host.includes("kakao") && (host.includes("map") || host.includes("place"))) return "kakao-map";
  if (host.includes("google") || host.includes("goo.gl") || host.includes("maps.app")) return "google-maps";
  return "generic";
}

// ─── HTML helpers ──────────────────────────────────────
function getMeta(html: string, property: string): string | null {
  const patterns = [
    new RegExp(
      `<meta[^>]+(?:property|name)=["']${escapeRegex(property)}["'][^>]+content=["']([^"']+)["']`,
      "i"
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escapeRegex(property)}["']`,
      "i"
    ),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) return decodeHtmlEntities(m[1]);
  }
  return null;
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function getTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return m?.[1] ? decodeHtmlEntities(m[1].trim()) : null;
}

function getJsonLd(html: string): Record<string, unknown>[] {
  const results: Record<string, unknown>[] = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(m[1]);
      if (Array.isArray(parsed)) {
        results.push(...parsed);
      } else {
        results.push(parsed);
      }
    } catch {
      // skip invalid JSON-LD
    }
  }
  return results;
}

function extractPrice(text: string): number | null {
  const cleaned = text.replace(/[,\s]/g, "");
  const m = cleaned.match(/[\d]+/);
  return m ? Number(m[0]) : null;
}

// ─── Category inference from JSON-LD type ─────────────
function inferCategoryFromType(type: string): PlaceCategory {
  const t = type.toLowerCase();
  if (t.includes("hotel") || t.includes("lodging") || t.includes("accommodation") || t.includes("hostel")) {
    return "accommodation";
  }
  if (t.includes("restaurant") || t.includes("cafe") || t.includes("food") || t.includes("bar")) {
    return "restaurant";
  }
  if (t.includes("tourist") || t.includes("museum") || t.includes("park") || t.includes("attraction")) {
    return "attraction";
  }
  return "other";
}

// ─── Collect multiple images ──────────────────────────
function collectImages(html: string, jsonLds: Record<string, unknown>[]): string[] {
  const images: string[] = [];
  const seen = new Set<string>();

  const addImage = (img: string | null | undefined) => {
    if (img && !seen.has(img)) {
      seen.add(img);
      images.push(img);
    }
  };

  for (const ld of jsonLds) {
    if (Array.isArray(ld.image)) {
      for (const img of ld.image) {
        addImage(typeof img === "string" ? img : (img as Record<string, string>)?.url);
      }
    } else if (ld.image) {
      addImage(typeof ld.image === "string" ? ld.image : (ld.image as Record<string, string>)?.url);
    }
  }

  const ogRe = /<meta[^>]+(?:property|name)=["']og:image["'][^>]+content=["']([^"']+)["']/gi;
  let ogM;
  while ((ogM = ogRe.exec(html)) !== null) {
    addImage(decodeHtmlEntities(ogM[1]));
  }

  return images.slice(0, 10);
}

// ─── Generic OG tag parser ─────────────────────────────
function parseGeneric(html: string, url: string): ScrapedPlace {
  const ogTitle = getMeta(html, "og:title");
  const ogDesc = getMeta(html, "og:description");
  const ogImage = getMeta(html, "og:image");
  const title = getTitle(html);

  const jsonLds = getJsonLd(html);
  let ldName: string | null = null;
  let ldAddress: string | null = null;
  let ldRating: number | null = null;
  let ldImage: string | null = null;
  let ldPrice: number | null = null;
  let ldCheckIn: string | null = null;
  let ldCheckOut: string | null = null;
  let ldPhone: string | null = null;
  let ldReviewCount: number | null = null;
  let ldAmenities: string[] = [];
  let ldCancelPolicy: string | null = null;
  let ldPriceRange: string | null = null;
  let ldDescription: string | null = null;
  let ldWebsite: string | null = null;
  let category: PlaceCategory = "other";

  for (const ld of jsonLds) {
    const rawType = ld["@type"];
    const typeStr = Array.isArray(rawType) ? rawType.join(" ") : String(rawType ?? "");
    const type = typeStr.toLowerCase();

    const isRelevant =
      type.includes("hotel") || type.includes("lodging") || type.includes("accommodation") ||
      type.includes("product") || type.includes("place") || type.includes("restaurant") ||
      type.includes("food") || type.includes("tourist") || type.includes("localbusiness") ||
      type.includes("store") || type.includes("cafe");

    if (isRelevant) {
      ldName = ldName ?? (ld.name as string) ?? null;
      category = inferCategoryFromType(type);

      const addr = ld.address as Record<string, string> | string | undefined;
      if (typeof addr === "string") {
        ldAddress = ldAddress ?? addr;
      } else if (addr && !ldAddress) {
        ldAddress = [addr.streetAddress, addr.addressLocality, addr.addressRegion, addr.addressCountry]
          .filter(Boolean)
          .join(", ");
      }

      const agg = ld.aggregateRating as Record<string, unknown> | undefined;
      if (agg?.ratingValue) ldRating = ldRating ?? Number(agg.ratingValue);
      if (agg?.reviewCount) ldReviewCount = ldReviewCount ?? Number(agg.reviewCount);
      if (!ldReviewCount && agg?.ratingCount) ldReviewCount = Number(agg.ratingCount);

      if (ld.image && !ldImage) {
        ldImage = typeof ld.image === "string" ? ld.image : (ld.image as Record<string, string>)?.url ?? null;
      }

      const offers = ld.offers as Record<string, unknown> | undefined;
      if (offers?.price) ldPrice = ldPrice ?? Number(offers.price);

      if (ld.checkinTime) ldCheckIn = ldCheckIn ?? String(ld.checkinTime);
      if (ld.checkoutTime) ldCheckOut = ldCheckOut ?? String(ld.checkoutTime);
      if (ld.telephone) ldPhone = ldPhone ?? String(ld.telephone);

      const amenities = ld.amenityFeature as Array<Record<string, string>> | undefined;
      if (Array.isArray(amenities) && ldAmenities.length === 0) {
        ldAmenities = amenities.map((a) => a.name ?? a.value).filter(Boolean);
      }

      const returnPolicy = ld.hasMerchantReturnPolicy as Record<string, string> | undefined;
      if (returnPolicy?.name) ldCancelPolicy = ldCancelPolicy ?? returnPolicy.name;

      if (ld.priceRange) ldPriceRange = ldPriceRange ?? String(ld.priceRange);
      if (ld.description) ldDescription = ldDescription ?? String(ld.description);
      if (ld.url) ldWebsite = ldWebsite ?? String(ld.url);
    }
  }

  // 메타태그 전화번호 폴백
  const metaPhone = getMeta(html, "telephone");
  const telMatch = html.match(/<a[^>]+href=["']tel:([^"']+)["']/i);
  const phone = ldPhone ?? metaPhone ?? (telMatch ? telMatch[1] : null);

  const imageUrls = collectImages(html, jsonLds);

  return {
    name: ldName ?? ogTitle ?? title ?? "",
    category,
    url,
    address: ldAddress ?? null,
    rating: ldRating,
    imageUrl: ldImage ?? ogImage ?? null,
    image_urls: imageUrls,
    price_per_night: ldPrice,
    cancel_policy: ldCancelPolicy,
    amenities: ldAmenities,
    check_in_time: ldCheckIn,
    check_out_time: ldCheckOut,
    memo: ogDesc ?? null,
    phone,
    website: ldWebsite,
    review_count: ldReviewCount,
    price_range: ldPriceRange,
    description: ldDescription ?? ogDesc ?? null,
  };
}

// ─── Site-specific parsers ─────────────────────────────
function parseBooking(html: string, url: string): ScrapedPlace {
  const base = parseGeneric(html, url);
  base.category = "accommodation";

  if (base.name) {
    base.name = base.name.replace(/\s*[-–|]\s*Booking\.com.*$/i, "").trim();
  }

  // 가격 (Booking 고유 메타태그)
  const priceStr = getMeta(html, "booking_com:price");
  if (priceStr) base.price_per_night = extractPrice(priceStr) ?? base.price_per_night;

  // 평점 (Booking 고유)
  const ratingStr = getMeta(html, "booking_com:rating");
  if (ratingStr) base.rating = Number(ratingStr) || base.rating;

  // 리뷰 수 (Booking 고유)
  const reviewStr = getMeta(html, "booking_com:reviews_count");
  if (reviewStr) base.review_count = Number(reviewStr.replace(/[,\s]/g, "")) || base.review_count;

  // 편의시설: data-testid="property-most-popular-facilities" 영역
  const facilitiesMatch = html.match(
    /data-testid=["']property-most-popular-facilities["'][^>]*>([\s\S]{0,5000}?)<\/div>/i
  );
  if (facilitiesMatch && base.amenities.length === 0) {
    const items = facilitiesMatch[1].match(/>([^<]{2,50})</g);
    if (items) {
      base.amenities = items
        .map((i) => i.replace(/^>/, "").trim())
        .filter((a) => a.length > 1 && a.length < 50);
    }
  }

  // 취소 정책
  if (!base.cancel_policy) {
    const cancelMatch = html.match(
      /(?:free cancellation|무료 취소|cancellation policy)[^<]{0,200}/i
    );
    if (cancelMatch) base.cancel_policy = cancelMatch[0].trim().slice(0, 200);
  }

  return base;
}

function parseAgoda(html: string, url: string): ScrapedPlace {
  const base = parseGeneric(html, url);
  base.category = "accommodation";

  if (base.name) {
    base.name = base.name.replace(/\s*[-–|]\s*Agoda.*$/i, "").trim();
  }

  const desc = getMeta(html, "og:description");
  if (desc) {
    // 가격
    const priceMatch = desc.match(/(?:₩|KRW|원)\s?[\d,]+/);
    if (priceMatch) base.price_per_night = extractPrice(priceMatch[0]) ?? base.price_per_night;

    // 할인 정보 → memo에 추가
    const discountMatch = desc.match(/(\d+%\s*(?:할인|OFF|off))/i);
    if (discountMatch) {
      base.memo = base.memo
        ? `${base.memo}\n할인: ${discountMatch[1]}`
        : `할인: ${discountMatch[1]}`;
    }

    // 리뷰 수
    const reviewMatch = desc.match(/리뷰\s*([\d,]+)\s*개/);
    if (reviewMatch) base.review_count = Number(reviewMatch[1].replace(/,/g, "")) || null;
  }

  return base;
}

function parseYanolja(html: string, url: string): ScrapedPlace {
  const base = parseGeneric(html, url);
  base.category = "accommodation";

  if (base.name) {
    base.name = base.name
      .replace(/\s*[-–|]\s*야놀자.*$/i, "")
      .replace(/\s*[-–|]\s*Yanolja.*$/i, "")
      .trim();
  }

  return base;
}

function parseGoodchoice(html: string, url: string): ScrapedPlace {
  const base = parseGeneric(html, url);
  base.category = "accommodation";

  if (base.name) {
    base.name = base.name.replace(/\s*[-–|]\s*여기어때.*$/i, "").trim();
  }

  return base;
}

function parseAirbnb(html: string, url: string): ScrapedPlace {
  const base = parseGeneric(html, url);
  base.category = "accommodation";

  if (base.name) {
    base.name = base.name
      .replace(/\s*[-–|]\s*Airbnb.*$/i, "")
      .replace(/\s*[-–|]\s*에어비앤비.*$/i, "")
      .trim();
  }

  return base;
}

// ─── New site parsers ─────────────────────────────────
function parseNaverMap(html: string, url: string): ScrapedPlace {
  const base = parseGeneric(html, url);

  if (base.name) {
    base.name = base.name
      .replace(/\s*[-–:]\s*네이버.*$/i, "")
      .replace(/\s*[-–:]\s*NAVER.*$/i, "")
      .replace(/\s*[-–:]\s*지도.*$/i, "")
      .trim();
  }

  // 네이버 플레이스 카테고리 추론
  const ogDesc = getMeta(html, "og:description") ?? "";
  if (ogDesc.includes("음식점") || ogDesc.includes("카페") || ogDesc.includes("맛집")) {
    base.category = "restaurant";
  } else if (ogDesc.includes("숙박") || ogDesc.includes("호텔") || ogDesc.includes("모텔")) {
    base.category = "accommodation";
  } else if (ogDesc.includes("관광") || ogDesc.includes("명소") || ogDesc.includes("공원")) {
    base.category = "attraction";
  }

  // 네이버 place 메타태그
  const placePhone = getMeta(html, "place:phone");
  if (placePhone) base.phone = placePhone;

  const placeAddr = getMeta(html, "place:location:address");
  if (placeAddr) base.address = placeAddr;

  // og:description에서 주소/전화 추출 (메타태그 없을 때)
  if (!base.address) {
    const addrMatch = ogDesc.match(/주소[:\s]+([^,|\n]+)/);
    if (addrMatch) base.address = addrMatch[1].trim();
  }
  if (!base.phone) {
    const phoneMatch = ogDesc.match(/(?:전화|연락처)[:\s]+([\d-]+)/);
    if (phoneMatch) base.phone = phoneMatch[1].trim();
  }

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

  // og:description에서 주소/전화 추출
  const desc = getMeta(html, "og:description") ?? "";
  if (!base.address) {
    const addrMatch = desc.match(/주소[:\s]+([^,|\n]+)/);
    if (addrMatch) base.address = addrMatch[1].trim();
  }
  if (!base.phone) {
    const phoneMatch = desc.match(/전화[:\s]+([\d-]+)/);
    if (phoneMatch) base.phone = phoneMatch[1].trim();
  }

  // 카테고리 추론
  if (desc.includes("음식점") || desc.includes("카페") || desc.includes("맛집")) {
    base.category = "restaurant";
  } else if (desc.includes("숙박") || desc.includes("호텔")) {
    base.category = "accommodation";
  } else if (desc.includes("관광") || desc.includes("명소")) {
    base.category = "attraction";
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

  // 구글맵은 SSR이 제한적이므로 Places API enricher에서 보강
  return base;
}

// ─── Main scrape function ──────────────────────────────
export async function scrapeUrl(url: string): Promise<ScrapedPlace> {
  // SSRF 방어: 프로토콜, 도메인, IP 검증
  await validateUrlSecurity(url);

  const html = await fetchWithSizeLimit(url);
  const site = detectSite(url);

  const parsers: Record<SiteName, (html: string, url: string) => ScrapedPlace> = {
    booking: parseBooking,
    agoda: parseAgoda,
    yanolja: parseYanolja,
    goodchoice: parseGoodchoice,
    airbnb: parseAirbnb,
    trip: parseGeneric,
    expedia: parseGeneric,
    hotels: parseGeneric,
    "naver-map": parseNaverMap,
    "kakao-map": parseKakaoMap,
    "google-maps": parseGoogleMaps,
    generic: parseGeneric,
  };

  const result = parsers[site](html, url);

  // Ensure absolute image URLs
  const baseUrl = new URL(url);
  if (result.imageUrl && !result.imageUrl.startsWith("http")) {
    result.imageUrl = new URL(result.imageUrl, baseUrl.origin).toString();
  }
  result.image_urls = result.image_urls.map((img) =>
    img.startsWith("http") ? img : new URL(img, baseUrl.origin).toString()
  );

  return result;
}
