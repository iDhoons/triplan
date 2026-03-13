import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/directions?origin=lat,lng&destination=lat,lng&mode=walking|transit|driving
 *
 * Google Directions API를 호출하여 이동 시간/거리를 반환한다.
 * - 인증 필수
 * - mode 기본값: transit
 * - 한국 등 walking/driving 미지원 지역에서는 자동으로 transit fallback
 * - transit도 실패 시 Haversine 직선거리 추정
 */

const EARTH_RADIUS_M = 6_371_000;

/** Haversine 직선거리 (미터) */
function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** 직선거리 기반 이동시간 추정 (초) */
function estimateDuration(distanceMeters: number, mode: string): number {
  // 도보 ~4.5km/h, 대중교통 ~25km/h, 자동차 ~35km/h (도심 평균)
  const speeds: Record<string, number> = {
    walking: 4500 / 3600,  // m/s
    transit: 25000 / 3600,
    driving: 35000 / 3600,
  };
  const speed = speeds[mode] ?? speeds.walking;
  // 직선→실제 경로 보정계수 1.4
  return Math.round((distanceMeters * 1.4) / speed);
}

async function fetchDirections(
  origin: string,
  destination: string,
  mode: string,
  apiKey: string
): Promise<{ status: string; routes: { legs: { duration: { value: number; text: string }; distance: { value: number; text: string } }[]; summary?: string }[] } | null> {
  const url = new URL("https://maps.googleapis.com/maps/api/directions/json");
  url.searchParams.set("origin", origin);
  url.searchParams.set("destination", destination);
  url.searchParams.set("mode", mode);
  url.searchParams.set("language", "ko");
  url.searchParams.set("key", apiKey);

  const res = await fetch(url.toString(), {
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) return null;
  const data = await res.json();
  if (data.status === "OK" && data.routes?.length) return data;
  return null;
}

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
  const mode = searchParams.get("mode") || "transit";

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
    // 요청된 mode로 시도
    let data = await fetchDirections(origin, destination, mode, apiKey);
    let usedMode = mode;

    // 실패 시 transit으로 fallback (한국 등에서 walking/driving 미지원)
    if (!data && mode !== "transit") {
      data = await fetchDirections(origin, destination, "transit", apiKey);
      usedMode = "transit";
    }

    // transit도 실패 → Haversine 추정
    if (!data) {
      const [lat1, lng1] = origin.split(",").map(Number);
      const [lat2, lng2] = destination.split(",").map(Number);
      const dist = Math.round(haversineDistance(lat1, lng1, lat2, lng2));
      const dur = estimateDuration(dist, mode);

      return NextResponse.json({
        duration_seconds: dur,
        distance_meters: dist,
        duration_text: dur >= 3600
          ? `약 ${Math.floor(dur / 3600)}시간 ${Math.round((dur % 3600) / 60)}분`
          : `약 ${Math.round(dur / 60)}분`,
        distance_text: dist >= 1000
          ? `${(dist / 1000).toFixed(1)}km`
          : `${dist}m`,
        summary: null,
        estimated: true,
        used_mode: mode,
      });
    }

    const leg = data.routes[0].legs[0];

    return NextResponse.json({
      duration_seconds: leg.duration.value,
      distance_meters: leg.distance.value,
      duration_text: leg.duration.text,
      distance_text: leg.distance.text,
      summary: data.routes[0].summary || null,
      estimated: false,
      used_mode: usedMode,
    });
  } catch (err) {
    console.error("[directions]", err);
    return NextResponse.json(
      { error: "이동 정보를 가져오는데 실패했습니다" },
      { status: 500 }
    );
  }
}
