/**
 * URL에서 장소명을 추출하는 유틸.
 * Booking.com, Agoda, Airbnb 등의 URL 패턴에서 호텔/장소명을 추출하고,
 * OG 메타태그 파싱이 실패해도 URL 경로에서 이름을 추정한다.
 */

import { lookup } from "node:dns/promises";

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

interface ParsedUrlInfo {
  placeName: string | null;
  site: string;
}

const SITE_PATTERNS: {
  match: RegExp;
  site: string;
  extract: (url: URL) => string | null;
}[] = [
  {
    // booking.com/hotel/jp/hotel-name.ko.html
    match: /booking\.com/i,
    site: "booking",
    extract: (url) => {
      const m = url.pathname.match(/\/hotel\/[^/]+\/([^/.]+)/);
      return m ? decodeAndClean(m[1]) : null;
    },
  },
  {
    // agoda.com/hotel-name/hotel/city-id.html
    // agoda.com/ko-kr/hotel-name/hotel/city-id.html (locale prefix)
    match: /agoda\.(com|net)/i,
    site: "agoda",
    extract: (url) => {
      // locale prefix (ko-kr, en-gb 등) 선택적 스킵 + 도시 정보도 추출
      const m = url.pathname.match(/^\/(?:[a-z]{2}(?:-[a-z]{2,4})?\/)?([^/]+)\/hotel\/([^/.]+)/i);
      if (!m) return null;
      // _숫자 접미사 제거 (Agoda 내부 식별자, 예: hotel-eden_2 → hotel eden)
      let name = decodeAndClean(m[1]).replace(/\s*\d+$/, "").trim();
      // 도시 정보 추가 (jeju-island-kr → jeju)
      const citySlug = m[2];
      if (citySlug) {
        const city = citySlug.replace(/-(?:kr|jp|th|vn|id|tw|cn|sg|my|ph|us|uk|au|all)\b.*$/i, "")
          .replace(/[-_]/g, " ").trim();
        if (city && !name.toLowerCase().includes(city.toLowerCase())) {
          name = `${name} ${city}`;
        }
      }
      return name;
    },
  },
  {
    // airbnb.com/rooms/12345 or airbnb.co.kr/rooms/12345
    match: /airbnb\.(com|co\.kr)/i,
    site: "airbnb",
    extract: () => null, // Airbnb URL에는 이름이 없음 — OG 태그 의존
  },
  {
    // yanolja.com/hotel/12345
    match: /yanolja\.com/i,
    site: "yanolja",
    extract: () => null,
  },
  {
    // goodchoice.kr or yeogi.com
    match: /(goodchoice\.kr|yeogi\.com)/i,
    site: "goodchoice",
    extract: () => null,
  },
  {
    // trip.com
    match: /trip\.com/i,
    site: "trip",
    extract: (url) => {
      const m = url.pathname.match(/\/hotels\/\d+\/([^/]+)/);
      return m ? decodeAndClean(m[1]) : null;
    },
  },
  {
    // expedia.com / expedia.co.kr
    match: /expedia\.(com|co\.kr)/i,
    site: "expedia",
    extract: (url) => {
      const m = url.pathname.match(/\/([^/]+)\.h\d+/);
      return m ? decodeAndClean(m[1]) : null;
    },
  },
  {
    // hotels.com
    match: /hotels\.com/i,
    site: "hotels",
    extract: (url) => {
      const m = url.pathname.match(/\/ho\d+\/([^/]+)/);
      return m ? decodeAndClean(m[1]) : null;
    },
  },
  {
    // Google Maps
    match: /google\.(com|co\.\w+)\/maps/i,
    site: "google-maps",
    extract: (url) => {
      const m = url.pathname.match(/\/place\/([^/@]+)/);
      return m ? decodeURIComponent(m[1]).replace(/\+/g, " ") : null;
    },
  },
  {
    // maps.app.goo.gl or goo.gl/maps (short link — needs redirect)
    match: /(maps\.app\.goo\.gl|goo\.gl\/maps)/i,
    site: "google-maps-short",
    extract: () => null, // Short URL — 리다이렉트 필요
  },
  {
    // Naver Map
    match: /naver\.(com|me)\/.*map/i,
    site: "naver-map",
    extract: () => null,
  },
  {
    // Kakao Map
    match: /kakao\.(com|co\.kr)\/.*map/i,
    site: "kakao-map",
    extract: () => null,
  },
];

/**
 * URL slug에서 사람이 읽을 수 있는 이름으로 변환
 * "hotel-nikko-osaka" → "hotel nikko osaka"
 */
function decodeAndClean(slug: string): string {
  return decodeURIComponent(slug)
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * URL에서 장소명과 사이트 정보를 추출
 */
export function parseUrl(rawUrl: string): ParsedUrlInfo {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { placeName: null, site: "unknown" };
  }

  for (const pattern of SITE_PATTERNS) {
    if (pattern.match.test(url.hostname + url.pathname)) {
      return {
        placeName: pattern.extract(url),
        site: pattern.site,
      };
    }
  }

  return { placeName: null, site: "unknown" };
}

/**
 * OG 메타태그에서 장소명 추출을 시도하는 가벼운 fetch.
 * 봇 차단될 수 있으므로 best-effort.
 */
export async function fetchOgTitle(url: string): Promise<string | null> {
  try {
    // SSRF 방어: 프로토콜 검증
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return null;
    }

    // SSRF 방어: DNS 해석 후 사설 IP 차단
    try {
      const { address } = await lookup(parsed.hostname);
      if (PRIVATE_IP_RANGES.some((re) => re.test(address))) {
        return null;
      }
    } catch {
      return null;
    }

    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; TravelPlannerBot/2.0; +https://travel-planner.app)",
        Accept: "text/html",
      },
      signal: AbortSignal.timeout(4000),
      redirect: "manual",
    });

    // 리다이렉트 시 Location도 SSRF 검증
    if ([301, 302, 303, 307, 308].includes(res.status)) {
      const location = res.headers.get("location");
      if (!location) return null;
      const redirectUrl = new URL(location, url);
      if (redirectUrl.protocol !== "https:" && redirectUrl.protocol !== "http:") {
        return null;
      }
      try {
        const { address } = await lookup(redirectUrl.hostname);
        if (PRIVATE_IP_RANGES.some((re) => re.test(address))) {
          return null;
        }
      } catch {
        return null;
      }
      // 리다이렉트 1회만 허용
      const redirectRes = await fetch(redirectUrl.toString(), {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; TravelPlannerBot/2.0; +https://travel-planner.app)",
          Accept: "text/html",
        },
        signal: AbortSignal.timeout(4000),
        redirect: "error",
      });
      if (!redirectRes.ok) return null;
      return extractOgTitleFromResponse(redirectRes);
    }

    if (!res.ok) return null;

    return extractOgTitleFromResponse(res);
  } catch {
    return null;
  }
}

async function extractOgTitleFromResponse(res: Response): Promise<string | null> {
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html")) return null;

  // 처음 50KB만 읽기 (메타태그는 head에 있으므로 충분)
  const reader = res.body?.getReader();
  if (!reader) return null;

  let html = "";
  const decoder = new TextDecoder();
  const MAX = 50 * 1024;

  while (html.length < MAX) {
    const { done, value } = await reader.read();
    if (done) break;
    html += decoder.decode(value, { stream: true });
  }
  reader.cancel();

  // og:title 추출
  const ogMatch = html.match(
    /<meta[^>]+(?:property|name)=["']og:title["'][^>]+content=["']([^"']+)["']/i
  );
  if (ogMatch?.[1]) {
    return ogMatch[1]
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .trim();
  }

  // <title> 태그 폴백
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return titleMatch?.[1]?.trim() ?? null;
}

/**
 * URL에서 장소명을 추출하는 메인 함수.
 * 1차: URL 패턴 매칭
 * 2차: OG 메타태그 fetch (best-effort)
 */
export async function extractPlaceName(
  rawUrl: string
): Promise<{ name: string | null; site: string }> {
  const parsed = parseUrl(rawUrl);

  if (parsed.placeName) {
    return { name: parsed.placeName, site: parsed.site };
  }

  // URL 패턴으로 추출 실패 → OG 메타태그 시도
  const ogTitle = await fetchOgTitle(rawUrl);
  if (ogTitle) {
    // 사이트명 접미사 제거
    const cleaned = ogTitle
      .replace(/\s*[-–|]\s*(Booking\.com|Agoda|Airbnb|에어비앤비|야놀자|여기어때|Trip\.com|Expedia|Hotels\.com).*$/i, "")
      .trim();
    return { name: cleaned || ogTitle, site: parsed.site };
  }

  return { name: null, site: parsed.site };
}
