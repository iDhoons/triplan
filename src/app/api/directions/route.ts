import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/directions?origin=lat,lng&destination=lat,lng&mode=walking|transit|driving
 *
 * Google Directions API를 호출하여 이동 시간/거리를 반환한다.
 * - 인증 필수
 * - mode 기본값: walking
 */
export async function GET(request: Request) {
  // 1. 인증 확인
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
  }

  // 2. 입력 파싱 & 검증
  const { searchParams } = new URL(request.url);
  const origin = searchParams.get("origin");
  const destination = searchParams.get("destination");
  const mode = searchParams.get("mode") || "walking";

  if (!origin || !destination) {
    return NextResponse.json(
      { error: "origin과 destination 파라미터가 필요합니다 (lat,lng 형식)" },
      { status: 400 }
    );
  }

  const validModes = ["walking", "transit", "driving"];
  if (!validModes.includes(mode)) {
    return NextResponse.json(
      { error: `mode는 ${validModes.join(", ")} 중 하나여야 합니다` },
      { status: 400 }
    );
  }

  // lat,lng 형식 검증
  const coordPattern = /^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/;
  if (!coordPattern.test(origin) || !coordPattern.test(destination)) {
    return NextResponse.json(
      { error: "좌표 형식이 올바르지 않습니다 (lat,lng)" },
      { status: 400 }
    );
  }

  // 3. Google Directions API 호출
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "서버 설정 오류: API 키 없음" },
      { status: 500 }
    );
  }

  try {
    const url = new URL("https://maps.googleapis.com/maps/api/directions/json");
    url.searchParams.set("origin", origin);
    url.searchParams.set("destination", destination);
    url.searchParams.set("mode", mode);
    url.searchParams.set("language", "ko");
    url.searchParams.set("key", apiKey);

    const res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      throw new Error(`Google API 응답 오류: ${res.status}`);
    }

    const data = await res.json();

    if (data.status !== "OK" || !data.routes?.length) {
      return NextResponse.json(
        {
          error: "경로를 찾을 수 없습니다",
          google_status: data.status,
        },
        { status: 404 }
      );
    }

    const leg = data.routes[0].legs[0];

    return NextResponse.json({
      duration_seconds: leg.duration.value,
      distance_meters: leg.distance.value,
      duration_text: leg.duration.text,
      distance_text: leg.distance.text,
      summary: data.routes[0].summary || null,
    });
  } catch (err) {
    console.error("[directions]", err);
    return NextResponse.json(
      { error: "이동 정보를 가져오는데 실패했습니다" },
      { status: 500 }
    );
  }
}
