import { lookup } from "node:dns/promises";
import type { PlaceCategory } from "@/types/database";

export interface ScrapedPlace {
  name: string;
  category: PlaceCategory;
  url: string;
  address: string | null;
  rating: number | null;
  imageUrl: string | null;
  price_per_night: number | null;
  cancel_policy: string | null;
  amenities: string[];
  check_in_time: string | null;
  check_out_time: string | null;
  memo: string | null;
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

  for (const ld of jsonLds) {
    const type = String(ld["@type"] ?? "").toLowerCase();
    if (
      type.includes("hotel") ||
      type.includes("lodging") ||
      type.includes("accommodation") ||
      type.includes("product") ||
      type.includes("place")
    ) {
      ldName = ldName ?? (ld.name as string) ?? null;

      const addr = ld.address as Record<string, string> | string | undefined;
      if (typeof addr === "string") {
        ldAddress = addr;
      } else if (addr) {
        ldAddress = [addr.streetAddress, addr.addressLocality, addr.addressRegion, addr.addressCountry]
          .filter(Boolean)
          .join(", ");
      }

      const agg = ld.aggregateRating as Record<string, unknown> | undefined;
      if (agg?.ratingValue) {
        ldRating = Number(agg.ratingValue);
      }

      if (ld.image) {
        ldImage = typeof ld.image === "string" ? ld.image : (ld.image as Record<string, string>)?.url ?? null;
      }

      const offers = ld.offers as Record<string, unknown> | undefined;
      if (offers?.price) {
        ldPrice = Number(offers.price);
      }

      if (ld.checkinTime) ldCheckIn = String(ld.checkinTime);
      if (ld.checkoutTime) ldCheckOut = String(ld.checkoutTime);
    }
  }

  return {
    name: ldName ?? ogTitle ?? title ?? "",
    category: "accommodation",
    url,
    address: ldAddress ?? null,
    rating: ldRating,
    imageUrl: ldImage ?? ogImage ?? null,
    price_per_night: ldPrice,
    cancel_policy: null,
    amenities: [],
    check_in_time: ldCheckIn,
    check_out_time: ldCheckOut,
    memo: ogDesc ?? null,
  };
}

// ─── Site-specific parsers ─────────────────────────────
function parseBooking(html: string, url: string): ScrapedPlace {
  const base = parseGeneric(html, url);

  if (base.name) {
    base.name = base.name.replace(/\s*[-–|]\s*Booking\.com.*$/i, "").trim();
  }

  const priceStr = getMeta(html, "booking_com:price");
  if (priceStr) {
    base.price_per_night = extractPrice(priceStr) ?? base.price_per_night;
  }

  return base;
}

function parseAgoda(html: string, url: string): ScrapedPlace {
  const base = parseGeneric(html, url);

  if (base.name) {
    base.name = base.name.replace(/\s*[-–|]\s*Agoda.*$/i, "").trim();
  }

  const desc = getMeta(html, "og:description");
  if (desc) {
    const priceMatch = desc.match(/(?:₩|KRW|원)\s?[\d,]+/);
    if (priceMatch) {
      base.price_per_night = extractPrice(priceMatch[0]) ?? base.price_per_night;
    }
  }

  return base;
}

function parseYanolja(html: string, url: string): ScrapedPlace {
  const base = parseGeneric(html, url);

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

  if (base.name) {
    base.name = base.name.replace(/\s*[-–|]\s*여기어때.*$/i, "").trim();
  }

  return base;
}

function parseAirbnb(html: string, url: string): ScrapedPlace {
  const base = parseGeneric(html, url);

  if (base.name) {
    base.name = base.name
      .replace(/\s*[-–|]\s*Airbnb.*$/i, "")
      .replace(/\s*[-–|]\s*에어비앤비.*$/i, "")
      .trim();
  }

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
    generic: parseGeneric,
  };

  const result = parsers[site](html, url);

  // Ensure absolute image URL
  if (result.imageUrl && !result.imageUrl.startsWith("http")) {
    const base = new URL(url);
    result.imageUrl = new URL(result.imageUrl, base.origin).toString();
  }

  return result;
}
