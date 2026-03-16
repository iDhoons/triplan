import { getPlaceDetails, getPhotoUrl } from "@/lib/google-places/client";
import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/guards";

/**
 * GET /api/places/resolve-photos?googlePlaceId=...&max=3
 * Google Place ID로 영구 프록시 photo URL을 반환한다.
 * 클라이언트 PlaceSearch에서 임시 CDN URL 대신 사용.
 */
export const GET = withAuth(async (request) => {
  const { searchParams } = new URL(request.url);
  const googlePlaceId = searchParams.get("googlePlaceId");
  const max = Math.min(Number(searchParams.get("max")) || 3, 5);

  if (!googlePlaceId) {
    return NextResponse.json(
      { error: "googlePlaceId가 필요합니다" },
      { status: 400 }
    );
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
    return NextResponse.json(
      { error: "사진 URL을 가져올 수 없습니다" },
      { status: 500 }
    );
  }
});
