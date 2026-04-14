import { NextResponse } from "next/server";
import { withAuth, checkRateLimit } from "@/lib/api/guards";
import { errorResponse } from "@/lib/api/error-response";
import { getPlaceDetails, getPhotoUrl, textSearch } from "@/lib/google-places/client";

/**
 * POST /api/places/repair-photos
 * 장소들의 사진을 복구/갱신한다.
 * - google_place_id가 있으면 Place Details API 사용
 * - 없으면 장소명으로 Text Search 후 사진 가져오기
 *
 * Body: { tripId: string, force?: boolean }
 * - force: true면 모든 장소의 사진을 갱신 (만료된 photo reference 해결용)
 */
export const POST = withAuth(async (request, { supabase, user }) => {
  // Rate limiting
  if (!(await checkRateLimit("places-repair", user.id, { maxRequests: 5 }))) {
    return errorResponse("RATE_LIMITED", "너무 많은 요청입니다. 잠시 후 다시 시도해주세요.");
  }

  const body = await request.json().catch(() => ({}));
  const tripId = body.tripId as string | undefined;
  const force = body.force === true;

  if (!tripId) {
    return errorResponse("BAD_REQUEST", "tripId가 필요합니다");
  }

  // 멤버십 확인
  const { data: membership } = await supabase
    .from("trip_members")
    .select("role")
    .eq("trip_id", tripId)
    .eq("user_id", user.id)
    .single();

  if (!membership || membership.role === "viewer") {
    return errorResponse("FORBIDDEN", "접근 권한이 없습니다");
  }

  // 모든 장소 조회 (image_urls 비어있는 것 필터링용)
  const { data: places, error: queryError } = await supabase
    .from("places")
    .select("id, name, google_place_id, image_urls")
    .eq("trip_id", tripId);

  if (queryError) {
    console.error("[repair-photos] Query error:", queryError);
    return errorResponse("INTERNAL_ERROR", "장소 조회 실패");
  }

  // force=true면 모든 장소, 아니면 사진 없는 장소만
  const placesToRepair = force
    ? (places ?? [])
    : (places ?? []).filter((p) => !p.image_urls || p.image_urls.length === 0);

  if (placesToRepair.length === 0) {
    return NextResponse.json({ repaired: 0, message: "수리할 장소가 없습니다" });
  }

  console.log(`[repair-photos] ${force ? "Force refresh" : "Repair"} ${placesToRepair.length} places`);

  let repairedCount = 0;
  const errors: string[] = [];

  for (const place of placesToRepair) {
    try {
      let photos: { name: string }[] | undefined;
      let newGooglePlaceId: string | null = null;

      if (place.google_place_id) {
        // google_place_id가 있으면 Place Details 사용
        const details = await getPlaceDetails(place.google_place_id);
        photos = details?.photos;
      } else if (place.name) {
        // 없으면 장소명으로 검색
        const results = await textSearch(place.name, { maxResultCount: 1 });
        if (results.length > 0) {
          photos = results[0].photos;
          newGooglePlaceId = results[0].id;
        }
      }

      if (!photos || photos.length === 0) {
        continue; // Google에 사진이 없음
      }

      // 최대 5개 사진 URL 생성
      const imageUrls: string[] = [];
      const max = Math.min(photos.length, 5);
      for (let i = 0; i < max; i++) {
        imageUrls.push(getPhotoUrl(photos[i].name));
      }

      const updateData: Record<string, unknown> = {
        image_urls: imageUrls,
        updated_at: new Date().toISOString(),
      };

      // google_place_id도 함께 저장 (새로 검색한 경우)
      if (newGooglePlaceId && !place.google_place_id) {
        updateData.google_place_id = newGooglePlaceId;
      }

      const { error: updateError } = await supabase
        .from("places")
        .update(updateData)
        .eq("id", place.id);

      if (updateError) {
        errors.push(`${place.name}: ${updateError.message}`);
      } else {
        repairedCount++;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "알 수 없는 오류";
      errors.push(`${place.name}: ${msg}`);
    }
  }

  return NextResponse.json({
    repaired: repairedCount,
    total: placesToRepair.length,
    errors: errors.length > 0 ? errors : undefined,
  });
});
