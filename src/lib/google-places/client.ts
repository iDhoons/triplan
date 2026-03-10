/**
 * Server-side Google Places API (New) HTTP client.
 * Uses GOOGLE_PLACES_API_KEY (never NEXT_PUBLIC_).
 */

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
 * Photo URI: Places photo reference → 실제 이미지 URL
 */
export function getPhotoUrl(
  photoName: string,
  maxWidth: number = 800
): string {
  return `${API_BASE}/${photoName}/media?maxWidthPx=${maxWidth}&key=${getApiKey()}`;
}
