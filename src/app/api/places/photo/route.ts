import { getPhotoUrlDirect } from "@/lib/google-places/client";
import { NextResponse } from "next/server";

/**
 * GET /api/places/photo?name=...&maxWidth=...
 * Google Places Photo를 프록시하여 API 키 노출을 방지한다.
 * 응답에 캐시 헤더를 설정하여 반복 호출을 줄인다.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const photoName = searchParams.get("name");
  const maxWidth = Math.min(
    Number(searchParams.get("maxWidth")) || 800,
    1600
  );

  if (!photoName || !photoName.startsWith("places/")) {
    return NextResponse.json(
      { error: "유효한 photo name이 필요합니다" },
      { status: 400 }
    );
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
    return NextResponse.json(
      { error: "이미지 프록시 실패" },
      { status: 500 }
    );
  }
}
