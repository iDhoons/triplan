/**
 * Server-side Google Places API (New) HTTP client.
 * Uses GOOGLE_PLACES_API_KEY (never NEXT_PUBLIC_).
 */

import type { GoogleAddressComponent } from "@/types/database";

const API_BASE = "https://places.googleapis.com/v1";

function getApiKey(): string {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) throw new Error("GOOGLE_PLACES_API_KEY is not set");
  return key;
}

// Basic + Contact fields only (cost-optimized)
const DEFAULT_FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.rating",
  "places.userRatingCount",
  "places.photos",
  "places.websiteUri",
  "places.types",
  "places.currentOpeningHours",
  "places.internationalPhoneNumber",
  "places.nationalPhoneNumber",
  "places.priceLevel",
  "places.businessStatus",
  "places.editorialSummary",
  "places.reviews",
  "places.addressComponents",
].join(",");

const DETAIL_FIELD_MASK = [
  "id",
  "displayName",
  "formattedAddress",
  "location",
  "rating",
  "userRatingCount",
  "photos",
  "websiteUri",
  "types",
  "currentOpeningHours",
  "internationalPhoneNumber",
  "nationalPhoneNumber",
  "priceLevel",
  "businessStatus",
  "editorialSummary",
  "reviews",
  "addressComponents",
].join(",");

export interface PlacesTextSearchResult {
  id: string;
  displayName: { text: string; languageCode: string };
  formattedAddress: string;
  location: { latitude: number; longitude: number };
  rating?: number;
  userRatingCount?: number;
  photos?: { name: string }[];
  websiteUri?: string;
  types?: string[];
  currentOpeningHours?: {
    weekdayDescriptions?: string[];
  };
  internationalPhoneNumber?: string;
  nationalPhoneNumber?: string;
  priceLevel?: string;
  businessStatus?: string;
  editorialSummary?: { text: string; languageCode?: string };
  reviews?: {
    text: { text: string };
    rating: number;
    relativePublishTimeDescription: string;
    authorAttribution?: { displayName: string };
  }[];
  addressComponents?: GoogleAddressComponent[];
}

/**
 * Text Search: 장소명으로 검색하여 후보 목록 반환
 */
export async function textSearch(
  query: string,
  options?: { languageCode?: string; maxResultCount?: number }
): Promise<PlacesTextSearchResult[]> {
  const res = await fetch(`${API_BASE}/places:searchText`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": getApiKey(),
      "X-Goog-FieldMask": DEFAULT_FIELD_MASK,
    },
    body: JSON.stringify({
      textQuery: query,
      languageCode: options?.languageCode ?? "ko",
      maxResultCount: options?.maxResultCount ?? 1,
    }),
    signal: AbortSignal.timeout(5000),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Places Text Search failed: ${res.status} ${err}`);
  }

  const data = await res.json();
  return (data.places ?? []) as PlacesTextSearchResult[];
}

/**
 * Place Details: Place ID로 상세 정보 조회
 */
export async function getPlaceDetails(
  placeId: string
): Promise<PlacesTextSearchResult | null> {
  const res = await fetch(`${API_BASE}/places/${placeId}`, {
    headers: {
      "X-Goog-Api-Key": getApiKey(),
      "X-Goog-FieldMask": DETAIL_FIELD_MASK,
    },
    signal: AbortSignal.timeout(5000),
  });

  if (!res.ok) return null;
  return (await res.json()) as PlacesTextSearchResult;
}

/**
 * Photo URI: Places photo reference → 서버 프록시 URL
 * API 키를 클라이언트에 노출하지 않기 위해 프록시 경로를 반환한다.
 */
export function getPhotoUrl(
  photoName: string,
  maxWidth: number = 800
): string {
  // photoName 예: "places/ChIJ.../photos/AUGGfZ..."
  // 프록시 API Route를 통해 서빙 (API 키는 서버에서만 사용)
  return `/api/places/photo?name=${encodeURIComponent(photoName)}&maxWidth=${maxWidth}`;
}

/**
 * 서버 전용: 실제 Google Places Photo URL 생성 (API 키 포함)
 * 프록시 API Route 내부에서만 사용할 것.
 */
export function getPhotoUrlDirect(
  photoName: string,
  maxWidth: number = 800
): string {
  return `${API_BASE}/${photoName}/media?maxWidthPx=${maxWidth}&key=${getApiKey()}`;
}
