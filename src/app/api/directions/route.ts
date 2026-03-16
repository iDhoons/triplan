import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/guards";
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

export const GET = withAuth(async (request) => {
  const { searchParams } = new URL(request.url);
  const origin = searchParams.get("origin");
  const destination = searchParams.get("destination");
  const mode = searchParams.get("mode") || "transit";

  if (!origin || !destination) {
    return NextResponse.json(
      { error: "origin과 destination 파라미터가 필요합니다 (lat,lng 형식)" },
      { status: 400 }
    );
  }

  if (!VALID_MODES.includes(mode)) {
    return NextResponse.json(
      { error: `mode는 ${VALID_MODES.join(", ")} 중 하나여야 합니다` },
      { status: 400 }
    );
  }

  if (!COORD_PATTERN.test(origin) || !COORD_PATTERN.test(destination)) {
    return NextResponse.json(
      { error: "좌표 형식이 올바르지 않습니다 (lat,lng)" },
      { status: 400 }
    );
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "서버 설정 오류: API 키 없음" },
      { status: 500 }
    );
  }

  try {
    const result = await getDirections(origin, destination, mode, apiKey);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[directions]", err);
    return NextResponse.json(
      { error: "이동 정보를 가져오는데 실패했습니다" },
      { status: 500 }
    );
  }
});
