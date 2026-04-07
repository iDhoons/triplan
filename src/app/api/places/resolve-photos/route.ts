import { getPlaceDetails, getPhotoUrl } from "@/lib/google-places/client";
import { NextResponse } from "next/server";
import { withAuth, checkRateLimit } from "@/lib/api/guards";
import { errorResponse } from "@/lib/api/error-response";

/**
 * GET /api/places/resolve-photos?googlePlaceId=...&max=3
 * Google Place ID로 영구 프록시 photo URL을 반환한다.
 * 클라이언트 PlaceSearch에서 임시 CDN URL 대신 사용.
 */
export const GET = withAuth(async (request, { user }) => {
  if (!(await checkRateLimit("resolve-photos", user.id, { maxRequests: 20 }))) {
    return errorResponse("RATE_LIMITED", "너무 많은 요청입니다. 잠시 후 다시 시도해주세요.");
  }

  const { searchParams } = new URL(request.url);
  const googlePlaceId = searchParams.get("googlePlaceId");
  const max = Math.min(Number(searchParams.get("max")) || 3, 5);

  if (!googlePlaceId) {
    return errorResponse("BAD_REQUEST", "googlePlaceId가 필요합니다");
  }

  // @TASK T7.5 - Place ID 형식 검증 (영숫자, _, - / 20~200자)
  if (!/^[a-zA-Z0-9_-]{20,200}$/.test(googlePlaceId)) {
    return errorResponse("BAD_REQUEST", "유효하지 않은 googlePlaceId 형식입니다");
  }

  try {
    const details = await getPlaceDetails(googlePlaceId);
    if (!details?.photos?.length) {
      return NextResponse.json({ urls: [] });
    }

    const urls = details.photos
      .slice(0, max)
      .map((p) => getPhotoUrl(p.name));

    return NextResponse.json({ urls });
  } catch (error) {
    console.error("[resolve-photos] Error:", error);
    return errorResponse("INTERNAL_ERROR", "사진 URL을 가져올 수 없습니다");
  }
});
