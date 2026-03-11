/**
 * Place 풍부화(Enrichment) 오케스트레이터.
 * URL → 장소명 추출 → Places API 검색 → DB 매핑 데이터 반환.
 */

import { textSearch, getPhotoUrl, type PlacesTextSearchResult } from "./client";
import { extractPlaceName } from "./url-parser";
import type { PlaceCategory } from "@/types/database";

export interface EnrichedPlaceData {
  name: string;
  category: PlaceCategory;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  rating: number | null;
  image_urls: string[];
  url: string | null;
  memo: string | null;
  opening_hours: Record<string, string> | null;
  google_place_id: string | null;
  phone: string | null;
  website: string | null;
  review_count: number | null;
  price_level: number | null;
  business_status: string | null;
  description: string | null;
}

/**
 * Google Places type → PlaceCategory 매핑
 */
function inferCategory(types: string[]): PlaceCategory {
  if (types.some((t) => ["lodging", "hotel", "resort_hotel", "motel", "hostel"].includes(t))) {
    return "accommodation";
  }
  if (types.some((t) => ["restaurant", "cafe", "bakery", "bar", "food", "meal_delivery", "meal_takeaway"].includes(t))) {
    return "restaurant";
  }
  if (types.some((t) => ["tourist_attraction", "museum", "amusement_park", "park", "zoo", "aquarium", "art_gallery", "stadium", "church"].includes(t))) {
    return "attraction";
  }
  return "other";
}

/**
 * Places API 결과 → EnrichedPlaceData 변환
 */
function parsePriceLevel(level?: string): number | null {
  if (!level) return null;
  const map: Record<string, number> = {
    PRICE_LEVEL_FREE: 0,
    PRICE_LEVEL_INEXPENSIVE: 1,
    PRICE_LEVEL_MODERATE: 2,
    PRICE_LEVEL_EXPENSIVE: 3,
    PRICE_LEVEL_VERY_EXPENSIVE: 4,
  };
  return map[level] ?? null;
}

function mapPlaceResult(
  place: PlacesTextSearchResult,
  sourceUrl: string
): EnrichedPlaceData {
  const imageUrls: string[] = [];
  if (place.photos) {
    const max = Math.min(place.photos.length, 5);
    for (let i = 0; i < max; i++) {
      imageUrls.push(getPhotoUrl(place.photos[i].name));
    }
  }

  let openingHours: Record<string, string> | null = null;
  if (place.currentOpeningHours?.weekdayDescriptions) {
    openingHours = {};
    for (const line of place.currentOpeningHours.weekdayDescriptions) {
      const parts = line.split(": ");
      if (parts.length >= 2) {
        openingHours[parts[0]] = parts.slice(1).join(": ");
      }
    }
  }

  const phone = place.internationalPhoneNumber ?? place.nationalPhoneNumber ?? null;
  const website = place.websiteUri ?? null;
  const reviewCount = place.userRatingCount ?? null;
  const priceLevel = parsePriceLevel(place.priceLevel);
  const businessStatus = place.businessStatus ?? null;
  const description = place.editorialSummary?.text ?? null;

  const memoLines: string[] = [];
  if (reviewCount) {
    memoLines.push(`리뷰 ${reviewCount.toLocaleString()}개`);
  }
  if (phone) {
    memoLines.push(`전화: ${phone}`);
  }
  if (website) {
    memoLines.push(`웹사이트: ${website}`);
  }

  // 비즈니스 상태 한글화
  if (businessStatus === "CLOSED_TEMPORARILY") {
    memoLines.push("임시 휴업 중");
  } else if (businessStatus === "CLOSED_PERMANENTLY") {
    memoLines.push("영구 폐업");
  }

  // 주요 리뷰 (최대 3개)
  if (place.reviews?.length) {
    const topReviews = place.reviews
      .slice(0, 3)
      .map((r) => {
        const author = r.authorAttribution?.displayName ?? "익명";
        const text = r.text.text.length > 80 ? r.text.text.slice(0, 80) + "..." : r.text.text;
        return `${author} (${r.rating}점): "${text}"`;
      })
      .join("\n");
    memoLines.push(`\n--- 주요 리뷰 ---\n${topReviews}`);
  }

  return {
    name: place.displayName?.text ?? "",
    category: inferCategory(place.types ?? []),
    address: place.formattedAddress ?? null,
    latitude: place.location?.latitude ?? null,
    longitude: place.location?.longitude ?? null,
    rating: place.rating ?? null,
    image_urls: imageUrls,
    url: sourceUrl,
    memo: memoLines.length > 0 ? memoLines.join("\n") : null,
    opening_hours: openingHours,
    google_place_id: place.id ?? null,
    phone,
    website,
    review_count: reviewCount,
    price_level: priceLevel,
    business_status: businessStatus,
    description,
  };
}

/**
 * URL을 받아 Places API로 풍부화한 데이터를 반환.
 * 실패 시 null 반환 (에러를 던지지 않음).
 */
export async function enrichFromUrl(
  sourceUrl: string
): Promise<EnrichedPlaceData | null> {
  // 1. URL에서 장소명 추출
  const { name } = await extractPlaceName(sourceUrl);
  if (!name) return null;

  // 2. Places API Text Search
  try {
    const results = await textSearch(name, { maxResultCount: 1 });
    if (results.length === 0) return null;

    return mapPlaceResult(results[0], sourceUrl);
  } catch (err) {
    console.error("[enricher] Places API error:", err);
    return null;
  }
}

/**
 * 텍스트 쿼리를 직접 Places API로 검색하여 풍부화 데이터를 반환.
 * URL 없이 장소명만 공유된 경우 사용.
 * 실패 시 null 반환 (에러를 던지지 않음).
 */
export async function enrichFromText(
  query: string
): Promise<EnrichedPlaceData | null> {
  try {
    const results = await textSearch(query, { maxResultCount: 1 });
    if (results.length === 0) return null;
    return mapPlaceResult(results[0], "");
  } catch (err) {
    console.error("[enricher] Text search error:", err);
    return null;
  }
}
