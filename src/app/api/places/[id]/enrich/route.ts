import { createClient } from "@/lib/supabase/server";
import { enrichFromUrl } from "@/lib/google-places";
import { NextResponse } from "next/server";

const MAX_ATTEMPTS = 3;

/**
 * POST /api/places/[id]/enrich
 * 클라이언트 트리거 풍부화: 미풍부화 장소에 Places API 데이터 채우기.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: placeId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // place 조회 + 권한 확인
  const { data: place } = await supabase
    .from("places")
    .select("id, source_url, enriched, enrich_attempts, trip_id")
    .eq("id", placeId)
    .single();

  if (!place) {
    return NextResponse.json({ error: "장소를 찾을 수 없습니다" }, { status: 404 });
  }

  // trip 멤버 확인
  const { data: membership } = await supabase
    .from("trip_members")
    .select("role")
    .eq("trip_id", place.trip_id)
    .eq("user_id", user.id)
    .single();

  if (!membership) {
    return NextResponse.json({ error: "접근 권한이 없습니다" }, { status: 403 });
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

    return NextResponse.json(
      { enriched: false, error: "정보를 가져오는 데 실패했습니다" },
      { status: 500 }
    );
  }
}
