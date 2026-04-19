import sharp from "sharp";
import { getPhotoUrlDirect } from "@/lib/google-places/client";
import { NextResponse } from "next/server";
import { checkIpRateLimit } from "@/lib/api/guards";
import { errorResponse } from "@/lib/api/error-response";

// CDN 캐시 파편화 방지 — 임의 maxWidth를 4단계 브레이크포인트로 snap
const WIDTH_BREAKPOINTS = [200, 400, 800, 1200] as const;
function snapWidth(w: number): number {
  return WIDTH_BREAKPOINTS.find((bp) => bp >= w) ?? 1200;
}

function getClientIp(request: Request): string {
  const forwarded = (request.headers as Headers).get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return (request.headers as Headers).get("x-real-ip") ?? "unknown";
}

/**
 * GET /api/places/photo?name=...&maxWidth=...
 * Google Places Photo를 프록시하여 API 키 노출을 방지한다.
 * 공개 엔드포인트 — 사진은 공개 데이터이므로 인증 불필요.
 * IP 기반 rate limiting으로 API 남용을 방지한다.
 */
export async function GET(request: Request) {
  const ip = getClientIp(request);
  if (!checkIpRateLimit(ip, { maxRequests: 120 })) {
    return errorResponse("RATE_LIMITED", "너무 많은 요청입니다. 잠시 후 다시 시도해주세요.");
  }

  const { searchParams } = new URL(request.url);
  const photoName = searchParams.get("name");
  const rawWidth = Math.min(Number(searchParams.get("maxWidth")) || 800, 1600);
  const maxWidth = snapWidth(rawWidth);

  if (!photoName || !photoName.startsWith("places/")) {
    return errorResponse("BAD_REQUEST", "유효한 photo name이 필요합니다");
  }

  try {
    const googleUrl = getPhotoUrlDirect(photoName, maxWidth);

    const res = await fetch(googleUrl, {
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      const code = res.status === 404 ? "NOT_FOUND" as const : "INTERNAL_ERROR" as const;
      return errorResponse(code, "이미지를 불러올 수 없습니다");
    }

    const imageBuffer = await res.arrayBuffer();
    const webpBuffer = await sharp(Buffer.from(imageBuffer))
      .webp({ quality: 80 })
      .toBuffer();

    return new NextResponse(new Uint8Array(webpBuffer), {
      status: 200,
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400",
        "CDN-Cache-Control": "public, max-age=604800, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    console.error("[photo proxy] Error:", error);
    return errorResponse("INTERNAL_ERROR", "이미지 프록시 실패");
  }
}
