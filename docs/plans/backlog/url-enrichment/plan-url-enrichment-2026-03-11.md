# URL 정보 수집 대폭 확장 Implementation Plan

**Goal:** URL에서 최대한 많은 정보(주소, 이미지, 전화, 리뷰, 편의시설, 메뉴 등)를 수집하도록 3개 영역(HTML 메타태그, Google Places API, 사이트별 파서)을 확장한다.

**Architecture:**
- `ScrapedPlace` + `EnrichedPlaceData` 인터페이스를 통합 확장하여 새 필드 추가
- Google Places API의 미사용 필드(reviews, priceLevel, businessStatus 등) 활성화
- 네이버 지도, 카카오맵, 구글맵 등 새 도메인을 화이트리스트에 추가하고 전용 파서 구현
- HTML 스크래핑과 Places API 결과를 머지하여 최대 정보량 확보

**Tech Stack:** Next.js 16 + TypeScript + Supabase + Google Places API (New)

---

## Phase 1: 타입 & 인터페이스 확장

### Task 1: Place 타입에 새 필드 추가

**Files:**
- Modify: `src/types/database.ts`

**변경 내용:**

Place 인터페이스에 다음 필드 추가:
```typescript
// 새 필드
phone: string | null;              // 전화번호
website: string | null;            // 공식 웹사이트
review_count: number | null;       // 리뷰 수
price_level: number | null;        // 가격 수준 (1-4, Google 기준)
price_range: string | null;        // 가격 범위 텍스트 ("₩₩₩")
business_status: string | null;    // 영업 상태 (OPERATIONAL, CLOSED_TEMPORARILY 등)
description: string | null;        // 장소 설명
```

**Step 1:** `Place` interface에 새 필드 추가
**Step 2:** 빌드 확인 (`npm run build`)

---

### Task 2: ScrapedPlace 인터페이스 확장

**Files:**
- Modify: `src/lib/scraper/index.ts`

**변경 내용:**

ScrapedPlace에 다음 필드 추가:
```typescript
phone: string | null;
website: string | null;
review_count: number | null;
price_range: string | null;
description: string | null;
image_urls: string[];          // 기존 imageUrl(단일) → image_urls(복수)로 확장
```

---

### Task 3: EnrichedPlaceData 인터페이스 확장

**Files:**
- Modify: `src/lib/google-places/enricher.ts`

**변경 내용:**

EnrichedPlaceData에 다음 필드 추가:
```typescript
phone: string | null;
website: string | null;
review_count: number | null;
price_level: number | null;
business_status: string | null;
description: string | null;
```

---

### Task 4: DB 마이그레이션

**Files:**
- Create: `supabase/migrations/XXXXXXX_add_place_detail_fields.sql`

**변경 내용:**

```sql
ALTER TABLE places
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS review_count integer,
  ADD COLUMN IF NOT EXISTS price_level smallint,
  ADD COLUMN IF NOT EXISTS price_range text,
  ADD COLUMN IF NOT EXISTS business_status text DEFAULT 'OPERATIONAL',
  ADD COLUMN IF NOT EXISTS description text;
```

---

## Phase 2: HTML 메타태그/JSON-LD 확장 추출

### Task 5: parseGeneric 함수 확장 — 새 메타태그 추출

**Files:**
- Modify: `src/lib/scraper/index.ts`

**변경 내용:**

`parseGeneric()` 함수에서 추가 추출:

1. **전화번호**: JSON-LD `telephone` + `<meta name="telephone">` + `<a href="tel:...">`
2. **리뷰 수**: JSON-LD `aggregateRating.reviewCount` / `ratingCount`
3. **편의시설**: JSON-LD `amenityFeature[].name`
4. **취소 정책**: JSON-LD `offers.hasMerchantReturnPolicy` 또는 사이트별
5. **가격 범위**: JSON-LD `priceRange` + `<meta property="og:price:amount">`
6. **설명**: `og:description` + JSON-LD `description`
7. **복수 이미지**: JSON-LD `image` 배열 + 추가 og:image 태그들
8. **웹사이트**: JSON-LD `url` 또는 `sameAs`

**핵심 코드 변경:**

```typescript
// JSON-LD에서 확장 필드 추출
let ldPhone: string | null = null;
let ldReviewCount: number | null = null;
let ldAmenities: string[] = [];
let ldCancelPolicy: string | null = null;
let ldPriceRange: string | null = null;
let ldDescription: string | null = null;
let ldImages: string[] = [];

for (const ld of jsonLds) {
  // 전화
  if (ld.telephone) ldPhone = String(ld.telephone);

  // 리뷰 수
  const agg = ld.aggregateRating as Record<string, unknown> | undefined;
  if (agg?.reviewCount) ldReviewCount = Number(agg.reviewCount);
  if (!ldReviewCount && agg?.ratingCount) ldReviewCount = Number(agg.ratingCount);

  // 편의시설
  const amenities = ld.amenityFeature as Array<Record<string, string>> | undefined;
  if (Array.isArray(amenities)) {
    ldAmenities = amenities.map(a => a.name ?? a.value).filter(Boolean);
  }

  // 가격 범위
  if (ld.priceRange) ldPriceRange = String(ld.priceRange);

  // 설명
  if (ld.description) ldDescription = String(ld.description);

  // 복수 이미지
  if (Array.isArray(ld.image)) {
    ldImages = ld.image.map(img =>
      typeof img === "string" ? img : (img as Record<string, string>)?.url
    ).filter(Boolean);
  }
}

// 메타태그 전화번호 폴백
const metaPhone = getMeta(html, "telephone");
// <a href="tel:..."> 패턴
const telMatch = html.match(/<a[^>]+href=["']tel:([^"']+)["']/i);
```

---

### Task 6: 사이트별 파서 강화 — Booking.com

**Files:**
- Modify: `src/lib/scraper/index.ts`

**변경 내용:**

`parseBooking()` 확장:

```typescript
function parseBooking(html: string, url: string): ScrapedPlace {
  const base = parseGeneric(html, url);

  // 이름 정리
  if (base.name) {
    base.name = base.name.replace(/\s*[-–|]\s*Booking\.com.*$/i, "").trim();
  }

  // 가격 (기존)
  const priceStr = getMeta(html, "booking_com:price");
  if (priceStr) base.price_per_night = extractPrice(priceStr) ?? base.price_per_night;

  // 평점 (Booking 고유 메타태그)
  const ratingStr = getMeta(html, "booking_com:rating");
  if (ratingStr) base.rating = Number(ratingStr) || base.rating;

  // 리뷰 수 (Booking 고유)
  const reviewStr = getMeta(html, "booking_com:reviews_count");
  if (reviewStr) base.review_count = Number(reviewStr.replace(/[,\s]/g, "")) || base.review_count;

  // 편의시설: data-testid="property-most-popular-facilities" 영역 파싱
  const facilitiesMatch = html.match(
    /data-testid=["']property-most-popular-facilities["'][^>]*>([\s\S]*?)<\/div>/i
  );
  if (facilitiesMatch) {
    const items = facilitiesMatch[1].match(/>([^<]{2,50})</g);
    if (items) {
      base.amenities = items
        .map(i => i.replace(/^>/, "").trim())
        .filter(a => a.length > 1 && a.length < 50);
    }
  }

  // 취소 정책
  const cancelMatch = html.match(
    /(?:cancellation|cancel_policy|free_cancellation)[^>]*>([^<]+)</i
  );
  if (cancelMatch) base.cancel_policy = cancelMatch[1].trim();

  return base;
}
```

---

### Task 7: 사이트별 파서 강화 — Agoda

**Files:**
- Modify: `src/lib/scraper/index.ts`

**변경 내용:**

`parseAgoda()` 확장 — 할인 정보, 편의시설 추출:

```typescript
function parseAgoda(html: string, url: string): ScrapedPlace {
  const base = parseGeneric(html, url);

  // 이름 정리
  if (base.name) {
    base.name = base.name.replace(/\s*[-–|]\s*Agoda.*$/i, "").trim();
  }

  // 가격 (기존 + 강화)
  const desc = getMeta(html, "og:description");
  if (desc) {
    const priceMatch = desc.match(/(?:₩|KRW|원)\s?[\d,]+/);
    if (priceMatch) base.price_per_night = extractPrice(priceMatch[0]) ?? base.price_per_night;

    // 할인 정보 → memo에 추가
    const discountMatch = desc.match(/(\d+%\s*할인|\d+%\s*OFF)/i);
    if (discountMatch) {
      base.memo = base.memo
        ? `${base.memo}\n할인: ${discountMatch[1]}`
        : `할인: ${discountMatch[1]}`;
    }
  }

  // 리뷰 수: og:description에서 "리뷰 N개" 패턴
  if (desc) {
    const reviewMatch = desc.match(/리뷰\s*([\d,]+)\s*개/);
    if (reviewMatch) base.review_count = Number(reviewMatch[1].replace(/,/g, "")) || null;
  }

  return base;
}
```

---

## Phase 3: Google Places API 확장

### Task 8: Places API 필드 마스크 확장

**Files:**
- Modify: `src/lib/google-places/client.ts`

**변경 내용:**

`DEFAULT_FIELD_MASK`와 `DETAIL_FIELD_MASK`에 새 필드 추가:

```typescript
// 추가할 필드들 (Places API New 기준)
"places.reviews",              // 리뷰 텍스트 (최대 5개)
"places.priceLevel",           // PRICE_LEVEL_FREE ~ PRICE_LEVEL_VERY_EXPENSIVE
"places.businessStatus",       // OPERATIONAL, CLOSED_TEMPORARILY, CLOSED_PERMANENTLY
"places.priceRange",           // { startPrice, endPrice }
"places.editorialSummary",     // 한 줄 설명
"places.nationalPhoneNumber",  // 국내 전화번호
```

**PlacesTextSearchResult 인터페이스 확장:**

```typescript
reviews?: {
  text: { text: string };
  rating: number;
  relativePublishTimeDescription: string;
  authorAttribution?: { displayName: string };
}[];
priceLevel?: string;
businessStatus?: string;
priceRange?: { startPrice?: { units: string }; endPrice?: { units: string } };
editorialSummary?: { text: string };
nationalPhoneNumber?: string;
```

> **비용 참고**: `reviews` 필드는 Places API (New) 기준 SKU: Place Details (Advanced) 사용 시 포함. 기본 검색 비용에 추가 비용 발생 가능.

---

### Task 9: enricher mapPlaceResult 확장

**Files:**
- Modify: `src/lib/google-places/enricher.ts`

**변경 내용:**

`mapPlaceResult()`에서 새 API 필드를 EnrichedPlaceData로 매핑:

```typescript
function mapPlaceResult(place, sourceUrl): EnrichedPlaceData {
  // ... 기존 코드 ...

  // 새 필드 매핑
  const phone = place.internationalPhoneNumber ?? place.nationalPhoneNumber ?? null;
  const website = place.websiteUri ?? null;
  const reviewCount = place.userRatingCount ?? null;
  const priceLevel = parsePriceLevel(place.priceLevel);
  const businessStatus = place.businessStatus ?? null;
  const description = place.editorialSummary?.text ?? null;

  // 리뷰 텍스트 → memo에 추가
  if (place.reviews?.length) {
    const topReviews = place.reviews
      .slice(0, 3)
      .map(r => `★${r.rating} "${r.text.text.slice(0, 100)}"`)
      .join("\n");
    memoLines.push(`\n--- 주요 리뷰 ---\n${topReviews}`);
  }

  // 비즈니스 상태 한글화
  if (businessStatus === "CLOSED_TEMPORARILY") {
    memoLines.push("⚠ 임시 휴업 중");
  } else if (businessStatus === "CLOSED_PERMANENTLY") {
    memoLines.push("❌ 영구 폐업");
  }

  return {
    ...existingFields,
    phone,
    website,
    review_count: reviewCount,
    price_level: priceLevel,
    business_status: businessStatus,
    description,
  };
}

function parsePriceLevel(level?: string): number | null {
  const map: Record<string, number> = {
    PRICE_LEVEL_FREE: 0,
    PRICE_LEVEL_INEXPENSIVE: 1,
    PRICE_LEVEL_MODERATE: 2,
    PRICE_LEVEL_EXPENSIVE: 3,
    PRICE_LEVEL_VERY_EXPENSIVE: 4,
  };
  return level ? (map[level] ?? null) : null;
}
```

---

## Phase 4: 사이트별 맞춤 파서 — 새 도메인 추가

### Task 10: 네이버 지도 파서 추가

**Files:**
- Modify: `src/lib/scraper/index.ts` (ALLOWED_DOMAINS, SiteName, detectSite, parsers)
- Modify: `src/lib/google-places/url-parser.ts` (네이버 지도 URL 패턴 강화)

**변경 내용:**

1. `ALLOWED_DOMAINS`에 네이버 지도 도메인 추가:
```typescript
"naver.me",
"map.naver.com",
"m.place.naver.com",
"pcmap.place.naver.com",
```

2. `SiteName`에 `"naver-map"` 추가

3. `detectSite()`에 네이버 지도 감지 추가

4. `parseNaverMap()` 구현:
```typescript
function parseNaverMap(html: string, url: string): ScrapedPlace {
  const base = parseGeneric(html, url);

  // 네이버 플레이스 JSON-LD는 LocalBusiness 타입 사용
  // og:title에서 장소명 추출
  if (base.name) {
    base.name = base.name
      .replace(/\s*[-–:]\s*네이버.*$/i, "")
      .replace(/\s*[-–:]\s*NAVER.*$/i, "")
      .trim();
  }

  // 네이버 플레이스 특유의 meta 태그
  const placeType = getMeta(html, "place:type");
  if (placeType) {
    if (placeType.includes("음식점") || placeType.includes("카페")) {
      base.category = "restaurant";
    } else if (placeType.includes("숙박")) {
      base.category = "accommodation";
    } else if (placeType.includes("관광") || placeType.includes("명소")) {
      base.category = "attraction";
    }
  }

  // 전화번호
  const phone = getMeta(html, "place:phone");
  if (phone) base.phone = phone;

  // 주소
  const addr = getMeta(html, "place:location:address");
  if (addr) base.address = addr;

  return base;
}
```

---

### Task 11: 카카오맵 파서 추가

**Files:**
- Modify: `src/lib/scraper/index.ts`

**변경 내용:**

1. `ALLOWED_DOMAINS`에 추가:
```typescript
"map.kakao.com",
"place.map.kakao.com",
```

2. `parseKakaoMap()` 구현:
```typescript
function parseKakaoMap(html: string, url: string): ScrapedPlace {
  const base = parseGeneric(html, url);

  if (base.name) {
    base.name = base.name
      .replace(/\s*[-–|]\s*카카오맵.*$/i, "")
      .replace(/\s*[-–|]\s*Kakao.*$/i, "")
      .trim();
  }

  // 카카오맵의 og:description에서 주소/전화 추출
  const desc = getMeta(html, "og:description");
  if (desc) {
    // "주소: xxx, 전화: xxx" 패턴
    const addrMatch = desc.match(/주소[:\s]+([^,|]+)/);
    if (addrMatch && !base.address) base.address = addrMatch[1].trim();

    const phoneMatch = desc.match(/전화[:\s]+([\d-]+)/);
    if (phoneMatch) base.phone = phoneMatch[1].trim();
  }

  return base;
}
```

---

### Task 12: 구글맵 파서 추가

**Files:**
- Modify: `src/lib/scraper/index.ts`
- Modify: `src/lib/google-places/url-parser.ts`

**변경 내용:**

1. `ALLOWED_DOMAINS`에 추가:
```typescript
"google.com",
"google.co.kr",
"maps.app.goo.gl",
"goo.gl",
```

2. 구글맵 URL에서 Place ID 추출 → 바로 `getPlaceDetails()` 호출:
```typescript
function parseGoogleMaps(html: string, url: string): ScrapedPlace {
  const base = parseGeneric(html, url);

  // URL에서 place ID 추출 (/place/.../@... 또는 ?ftid=0x...)
  const ftidMatch = url.match(/ftid=([^&]+)/);
  const cidMatch = url.match(/cid=(\d+)/);

  // 구글맵은 SSR 제한적 → Places API에 위임 (enricher에서 처리)
  if (base.name) {
    base.name = base.name
      .replace(/\s*[-–]\s*Google Maps.*$/i, "")
      .replace(/\s*[-–]\s*Google 지도.*$/i, "")
      .trim();
  }

  return base;
}
```

3. `url-parser.ts`의 구글맵 패턴에서 Place ID 추출 강화:
```typescript
{
  match: /google\.(com|co\.\w+)\/maps/i,
  site: "google-maps",
  extract: (url) => {
    // /place/장소명/@lat,lng 패턴
    const placeMatch = url.pathname.match(/\/place\/([^/@]+)/);
    if (placeMatch) return decodeURIComponent(placeMatch[1]).replace(/\+/g, " ");

    // ?q=검색어 패턴
    const qParam = url.searchParams.get("q");
    if (qParam) return decodeURIComponent(qParam);

    return null;
  },
},
```

---

## Phase 5: API 응답 통합 & 데이터 머지

### Task 13: scrape API 응답에 새 필드 포함

**Files:**
- Modify: `src/app/api/scrape/route.ts`

**변경 내용:**

Places API 폴백 응답에 새 필드 전부 포함:

```typescript
// 기존: imageUrl만 반환 → image_urls 배열로 확장
return NextResponse.json({
  name: enriched.name,
  category: enriched.category,
  url,
  address: enriched.address,
  rating: enriched.rating,
  imageUrl: enriched.image_urls[0] ?? null,
  image_urls: enriched.image_urls,        // 새 필드
  price_per_night: null,
  cancel_policy: null,
  amenities: [],
  check_in_time: null,
  check_out_time: null,
  memo: enriched.memo,
  phone: enriched.phone,                  // 새 필드
  website: enriched.website,              // 새 필드
  review_count: enriched.review_count,    // 새 필드
  price_level: enriched.price_level,      // 새 필드
  description: enriched.description,      // 새 필드
  opening_hours: enriched.opening_hours,  // 새 필드
  latitude: enriched.latitude,            // 새 필드
  longitude: enriched.longitude,          // 새 필드
  google_place_id: enriched.google_place_id,
});
```

---

### Task 14: HTML 스크래핑 + Places API 결과 머지

**Files:**
- Modify: `src/app/api/scrape/route.ts`

**변경 내용:**

화이트리스트 도메인 URL의 경우, HTML 스크래핑 성공 후에도 Places API로 보강하여 빈 필드를 채우는 **머지 전략** 추가:

```typescript
// 스크래핑 성공 후 Places API 보강 (좌표, 전화 등 부족한 정보 채우기)
const scraped = await scrapeUrl(url);

// Places API로 추가 정보 획득 시도
let enriched: EnrichedPlaceData | null = null;
try {
  const { enrichFromUrl } = await import("@/lib/google-places");
  enriched = await enrichFromUrl(url);
} catch {
  // Places API 실패해도 스크래핑 결과는 반환
}

// 머지: 스크래핑 우선, 빈 필드만 Places로 채움
return NextResponse.json({
  ...scraped,
  address: scraped.address ?? enriched?.address ?? null,
  rating: scraped.rating ?? enriched?.rating ?? null,
  image_urls: scraped.image_urls.length > 0
    ? scraped.image_urls
    : enriched?.image_urls ?? [],
  phone: scraped.phone ?? enriched?.phone ?? null,
  website: scraped.website ?? enriched?.website ?? null,
  review_count: scraped.review_count ?? enriched?.review_count ?? null,
  latitude: enriched?.latitude ?? null,
  longitude: enriched?.longitude ?? null,
  opening_hours: enriched?.opening_hours ?? null,
  google_place_id: enriched?.google_place_id ?? null,
  description: scraped.description ?? enriched?.description ?? null,
  price_level: enriched?.price_level ?? null,
});
```

---

### Task 15: share API 백그라운드 풍부화에 새 필드 저장

**Files:**
- Modify: `src/app/api/places/share/route.ts`

**변경 내용:**

`enrichPlaceInBackground()`에서 새 필드도 DB에 저장:

```typescript
await supabase
  .from("places")
  .update({
    // 기존 필드
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
    // 새 필드
    phone: enriched.phone,
    website: enriched.website,
    review_count: enriched.review_count,
    price_level: enriched.price_level,
    business_status: enriched.business_status,
    description: enriched.description,
    // 상태
    enriched: true,
    enriched_at: new Date().toISOString(),
    enrich_attempts: 1,
    enrich_error: null,
  })
  .eq("id", placeId);
```

---

## Phase 6: 검증 & 테스트

### Task 16: 빌드 검증 & 타입 체크

**Step 1:** `npm run build` — 타입 에러 없는지 확인
**Step 2:** 새 필드가 프론트엔드 컴포넌트에서 접근 가능한지 확인
**Step 3:** 기존 place-form.tsx 등에서 새 필드를 표시하도록 수정이 필요한지 확인

### Task 17: 수동 테스트 시나리오

| # | 입력 URL | 예상 결과 |
|---|---------|----------|
| 1 | Booking.com 호텔 URL | 이름, 가격, 편의시설, 리뷰 수, 취소정책 추출 |
| 2 | Agoda 호텔 URL | 이름, 가격, 할인 정보, 리뷰 수 추출 |
| 3 | 네이버 지도 맛집 URL | 이름, 주소, 전화, 카테고리 추출 |
| 4 | 카카오맵 URL | 이름, 주소, 전화 추출 |
| 5 | 구글맵 URL | 이름, 주소 → Places API로 전체 보강 |
| 6 | 비지원 도메인 URL | Places API 폴백으로 기본 정보 추출 |
| 7 | Airbnb 숙소 URL | 이름, 이미지, 가격 추출 |

---

## 실행 배치 계획

| 배치 | Tasks | 설명 |
|------|-------|------|
| Batch 1 | Task 1-4 | 타입 & DB 기반 작업 |
| Batch 2 | Task 5-7 | HTML 스크래핑 확장 |
| Batch 3 | Task 8-9 | Google Places API 확장 |
| Batch 4 | Task 10-12 | 새 도메인 파서 |
| Batch 5 | Task 13-15 | API 응답 통합 & 머지 |
| Batch 6 | Task 16-17 | 검증 & 테스트 |

---

## Open Questions

1. **Places API 비용**: `reviews` 필드 포함 시 Advanced SKU 요금 적용 — 사용량에 따라 비용 증가 가능. 리뷰 포함 여부 최종 확인 필요?
2. **네이버 지도 봇 차단**: 네이버 플레이스는 JavaScript 렌더링 필수인 경우가 많음 — SSR HTML에서 추출 가능한 범위가 제한적일 수 있음. OG 태그만으로도 이름/주소/전화 추출 가능.
3. **DB 마이그레이션 적용**: Supabase 대시보드에서 직접 실행 vs `supabase migration` CLI?
