import { NextResponse } from "next/server";
import { withAuth, checkRateLimit } from "@/lib/api/guards";
import { errorResponse } from "@/lib/api/error-response";
import { getDirections } from "@/lib/directions/client";

/**
 * GET /api/directions?origin=lat,lng&destination=lat,lng&mode=walking|transit|driving
 *
 * Directions Gateway를 통해 이동 시간/거리를 반환한다.
 * - 인증 필수 (withAuth)
 * - 비즈니스 로직은 lib/directions/client.ts에 위임
 */

const VALID_MODES = ["walking", "transit", "driving"];
const COORD_PATTERN = /^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/;

export const GET = withAuth(async (request, { user }) => {
  if (!(await checkRateLimit("directions", user.id, { maxRequests: 30 }))) {
    return errorResponse("RATE_LIMITED", "너무 많은 요청입니다. 잠시 후 다시 시도해주세요.");
  }

  const { searchParams } = new URL(request.url);
  const origin = searchParams.get("origin");
  const destination = searchParams.get("destination");
  const mode = searchParams.get("mode") || "transit";
  const departureTime = searchParams.get("departureTime") || undefined;

  if (!origin || !destination) {
    return errorResponse("BAD_REQUEST", "origin과 destination 파라미터가 필요합니다 (lat,lng 형식)");
  }

  if (!VALID_MODES.includes(mode)) {
    return errorResponse("BAD_REQUEST", `mode는 ${VALID_MODES.join(", ")} 중 하나여야 합니다`);
  }

  if (!COORD_PATTERN.test(origin) || !COORD_PATTERN.test(destination)) {
    return errorResponse("BAD_REQUEST", "좌표 형식이 올바르지 않습니다 (lat,lng)");
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return errorResponse("INTERNAL_ERROR", "서버 설정 오류: API 키 없음");
  }

  try {
    const result = await getDirections(origin, destination, mode, apiKey, departureTime);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[directions]", err);
    return errorResponse("INTERNAL_ERROR", "이동 정보를 가져오는데 실패했습니다");
  }
});
