import { enrichFromUrl } from "@/lib/google-places";
import { NextResponse } from "next/server";
import { withAuth, checkRateLimit } from "@/lib/api/guards";
import { errorResponse } from "@/lib/api/error-response";

const MAX_ATTEMPTS = 3;

/**
 * POST /api/places/[id]/enrich
 * 클라이언트 트리거 풍부화: 미풍부화 장소에 Places API 데이터 채우기.
 */
export const POST = withAuth(async (
  _request,
  { supabase, user }
) => {
  // Rate limiting — Google Places API 호출 보호
  if (!checkRateLimit("places-enrich", user.id, { maxRequests: 10 })) {
    return errorResponse("RATE_LIMITED", "너무 많은 요청입니다. 잠시 후 다시 시도해주세요.");
  }

  // Next.js dynamic route params — withAuth 밖에서 접근 불가하므로 URL에서 추출
  const url = new URL(_request.url);
  const placeId = url.pathname.split("/places/")[1]?.split("/")[0];
  if (!placeId) {
    return errorResponse("BAD_REQUEST", "place ID가 필요합니다");
  }

  // place 조회 + 권한 확인
  const { data: place } = await supabase
    .from("places")
    .select("id, source_url, enriched, enrich_attempts, trip_id")
    .eq("id", placeId)
    .single();

  if (!place) {
    return errorResponse("NOT_FOUND", "장소를 찾을 수 없습니다");
  }

  // trip 멤버 확인
  const { data: membership } = await supabase
    .from("trip_members")
    .select("role")
    .eq("trip_id", place.trip_id)
    .eq("user_id", user.id)
    .single();

  if (!membership) {
    return errorResponse("FORBIDDEN", "접근 권한이 없습니다");
  }

  // 이미 풍부화됨 → 기존 데이터 반환
  if (place.enriched) {
    const { data: fullPlace } = await supabase
      .from("places")
      .select("*")
      .eq("id", placeId)
      .single();
    return NextResponse.json({ enriched: true, place: fullPlace });
  }

  // 재시도 한도 초과
  if (place.enrich_attempts >= MAX_ATTEMPTS) {
    return NextResponse.json({
      enriched: false,
      error: "최대 재시도 횟수를 초과했습니다. 수동으로 정보를 입력해주세요.",
      attempts: place.enrich_attempts,
    });
  }

  if (!place.source_url) {
    return NextResponse.json({
      enriched: false,
      error: "원본 URL이 없습니다",
    });
  }

  // 풍부화 시도
  try {
    const enriched = await enrichFromUrl(place.source_url);

    if (!enriched) {
      await supabase
        .from("places")
        .update({
          enrich_attempts: (place.enrich_attempts ?? 0) + 1,
          enrich_error: "장소 정보를 찾을 수 없습니다",
        })
        .eq("id", placeId);

      return NextResponse.json({
        enriched: false,
        error: "장소 정보를 찾을 수 없습니다",
        attempts: (place.enrich_attempts ?? 0) + 1,
      });
    }

    const { data: updatedPlace, error: updateErr } = await supabase
      .from("places")
      .update({
        name: enriched.name,
        category: enriched.category,
        address: enriched.address,
        address_components: enriched.address_components,
        latitude: enriched.latitude,
        longitude: enriched.longitude,
        rating: enriched.rating,
        image_urls: enriched.image_urls,
        memo: enriched.memo,
        opening_hours: enriched.opening_hours,
        google_place_id: enriched.google_place_id,
        enriched: true,
        enriched_at: new Date().toISOString(),
        enrich_attempts: (place.enrich_attempts ?? 0) + 1,
        enrich_error: null,
      })
      .eq("id", placeId)
      .select("*")
      .single();

    if (updateErr) {
      throw updateErr;
    }

    return NextResponse.json({ enriched: true, place: updatedPlace });
  } catch (err) {
    console.error("[enrich] Error:", err);

    try {
      await supabase
        .from("places")
        .update({
          enrich_attempts: (place.enrich_attempts ?? 0) + 1,
          enrich_error: err instanceof Error ? err.message : "풍부화 실패",
        })
        .eq("id", placeId);
    } catch {
      // 에러 기록 실패 무시
    }

    return errorResponse("INTERNAL_ERROR", "정보를 가져오는 데 실패했습니다");
  }
});
