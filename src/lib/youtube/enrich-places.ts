import "server-only";

import pLimit from "p-limit";
import { enrichFromText } from "@/lib/google-places/enricher";
import type { ExtractedPlace } from "@/types/youtube";
import type { createClient } from "@/lib/supabase/server";

// ── 타입 ──

export interface EnrichedExtractedPlace extends ExtractedPlace {
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  rating: number | null;
  image_urls: string[];
  google_place_id: string | null;
  phone: string | null;
  website: string | null;
  review_count: number | null;
  description: string | null;
  enriched: boolean;
  opening_hours: Record<string, string> | null;
  price_level: number | null;
  business_status: string | null;
  memo: string | null;
}

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

// ── 헬퍼 ──

function createUnenrichedPlace(place: ExtractedPlace): EnrichedExtractedPlace {
  return {
    ...place,
    address: null,
    latitude: null,
    longitude: null,
    rating: null,
    image_urls: [],
    google_place_id: null,
    phone: null,
    website: null,
    review_count: null,
    description: null,
    enriched: false,
    opening_hours: null,
    price_level: null,
    business_status: null,
    memo: `[YouTube 추출] ${place.context}`,
  };
}

// ── Places API 보강 ──

const CONCURRENCY = 3;

export async function enrichSelectedPlaces(
  places: ExtractedPlace[]
): Promise<EnrichedExtractedPlace[]> {
  const limit = pLimit(CONCURRENCY);

  const results = await Promise.allSettled(
    places.map((place) =>
      limit(async (): Promise<EnrichedExtractedPlace> => {
        const enriched = await enrichFromText(place.name);

        if (!enriched) {
          return createUnenrichedPlace(place);
        }

        return {
          ...place,
          category: enriched.category,
          address: enriched.address,
          latitude: enriched.latitude,
          longitude: enriched.longitude,
          rating: enriched.rating,
          image_urls: enriched.image_urls,
          google_place_id: enriched.google_place_id,
          phone: enriched.phone,
          website: enriched.website,
          review_count: enriched.review_count,
          description: enriched.description,
          enriched: true,
          opening_hours: enriched.opening_hours,
          price_level: enriched.price_level,
          business_status: enriched.business_status,
          memo: enriched.memo
            ? `${enriched.memo}\n\n[YouTube] ${place.context}`
            : `[YouTube] ${place.context}`,
        };
      })
    )
  );

  return results.map((result, i) => {
    if (result.status === "fulfilled") return result.value;
    return createUnenrichedPlace(places[i]);
  });
}

// ── 중복 체크 ──

export interface DuplicateCheckResult {
  newPlaces: EnrichedExtractedPlace[];
  duplicates: EnrichedExtractedPlace[];
}

export async function checkDuplicates(
  tripId: string,
  places: EnrichedExtractedPlace[],
  supabase: SupabaseClient
): Promise<DuplicateCheckResult> {
  if (places.length === 0) return { newPlaces: [], duplicates: [] };

  // 후보 google_place_id와 name으로 필터링하여 조회
  const candidateGoogleIds = places
    .map((p) => p.google_place_id)
    .filter((id): id is string => id !== null);
  const candidateNames = places.map((p) => p.name.trim().toLowerCase());

  // OR 필터: google_place_id IN (...) OR name IN (...)
  let query = supabase
    .from("places")
    .select("google_place_id, name")
    .eq("trip_id", tripId);

  if (candidateGoogleIds.length > 0) {
    query = query.or(
      `google_place_id.in.(${candidateGoogleIds.join(",")}),name.in.(${candidateNames.join(",")})`
    );
  }

  const { data: existingPlaces } = await query;

  const existingGoogleIds = new Set(
    (existingPlaces ?? [])
      .map((p: { google_place_id: string | null }) => p.google_place_id)
      .filter(Boolean)
  );
  const existingNames = new Set(
    (existingPlaces ?? [])
      .map((p: { name: string }) => p.name.trim().toLowerCase())
  );

  const newPlaces: EnrichedExtractedPlace[] = [];
  const duplicates: EnrichedExtractedPlace[] = [];

  for (const place of places) {
    const isDup =
      (place.google_place_id && existingGoogleIds.has(place.google_place_id)) ||
      existingNames.has(place.name.trim().toLowerCase());

    if (isDup) {
      duplicates.push(place);
    } else {
      newPlaces.push(place);
    }
  }

  return { newPlaces, duplicates };
}
