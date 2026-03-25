import { getPhotoUrlDirect } from "@/lib/google-places/client";
import { NextResponse } from "next/server";
import { withAuth, checkRateLimit } from "@/lib/api/guards";
import { errorResponse } from "@/lib/api/error-response";

/**
 * GET /api/places/photo?name=...&maxWidth=...
 * Google Places Photo를 프록시하여 API 키 노출을 방지한다.
 * 인증 필수 — 미인증 사용자의 API 할당량 소진 방지.
 * 응답에 캐시 헤더를 설정하여 반복 호출을 줄인다.
 */
export const GET = withAuth(async (request, { user }) => {
  if (!checkRateLimit("places-photo", user.id, { maxRequests: 60 })) {
    return errorResponse("RATE_LIMITED", "너무 많은 요청입니다. 잠시 후 다시 시도해주세요.");
  }

  const { searchParams } = new URL(request.url);
  const photoName = searchParams.get("name");
  const maxWidth = Math.min(
    Number(searchParams.get("maxWidth")) || 800,
    1600
  );

  if (!photoName || !photoName.startsWith("places/")) {
    return errorResponse("BAD_REQUEST", "유효한 photo name이 필요합니다");
  }

  try {
    const googleUrl = getPhotoUrlDirect(photoName, maxWidth);
    const res = await fetch(googleUrl, {
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: "이미지를 불러올 수 없습니다" },
        { status: res.status }
      );
    }

    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    const imageBuffer = await res.arrayBuffer();

    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, s-maxage=604800",
        "CDN-Cache-Control": "public, max-age=604800",
      },
    });
  } catch (error) {
    console.error("[photo proxy] Error:", error);
    return errorResponse("INTERNAL_ERROR", "이미지 프록시 실패");
  }
});
