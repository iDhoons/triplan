/**
 * Google Directions API Gateway (Anti-Corruption Layer)
 *
 * weather/client.ts와 동일한 패턴:
 * - 외부 API 응답을 도메인 타입으로 변환
 * - Fallback 체인: 요청 mode → transit → Haversine 추정
 * - 순수 함수(haversineDistance, estimateDuration)는 export하여 테스트 가능
 */

// -----------------------------------------------------------------------
// 순수 함수 (외부 의존성 없음)
// -----------------------------------------------------------------------

const EARTH_RADIUS_M = 6_371_000;

/** Haversine 직선거리 (미터) */
export function haversineDistance(
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
export function estimateDuration(distanceMeters: number, mode: string): number {
  const speeds: Record<string, number> = {
    walking: 4500 / 3600,
    transit: 25000 / 3600,
    driving: 35000 / 3600,
  };
  const speed = speeds[mode] ?? speeds.walking;
  return Math.round((distanceMeters * 1.4) / speed);
}

// -----------------------------------------------------------------------
// 도메인 타입
// -----------------------------------------------------------------------

export interface DirectionsResult {
  duration_seconds: number;
  distance_meters: number;
  duration_text: string;
  distance_text: string;
  summary: string | null;
  estimated: boolean;
  used_mode: string;
}

// -----------------------------------------------------------------------
// Google Directions API 호출
// -----------------------------------------------------------------------

interface GoogleDirectionsResponse {
  status: string;
  routes: {
    legs: {
      duration: { value: number; text: string };
      distance: { value: number; text: string };
    }[];
    summary?: string;
  }[];
}

async function fetchGoogleDirections(
  origin: string,
  destination: string,
  mode: string,
  apiKey: string
): Promise<GoogleDirectionsResponse | null> {
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

// -----------------------------------------------------------------------
// 헬퍼
// -----------------------------------------------------------------------

function formatDurationText(seconds: number): string {
  if (seconds >= 3600) {
    return `약 ${Math.floor(seconds / 3600)}시간 ${Math.round((seconds % 3600) / 60)}분`;
  }
  return `약 ${Math.round(seconds / 60)}분`;
}

function formatDistanceText(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)}km`;
  return `${meters}m`;
}

// -----------------------------------------------------------------------
// Public API: Fallback 체인
// -----------------------------------------------------------------------

/**
 * 이동 정보를 조회한다 (mode → transit fallback → Haversine 추정).
 *
 * @param origin "lat,lng" 형식
 * @param destination "lat,lng" 형식
 * @param mode "walking" | "transit" | "driving"
 * @param apiKey Google Directions API 키
 */
export async function getDirections(
  origin: string,
  destination: string,
  mode: string,
  apiKey: string
): Promise<DirectionsResult> {
  // 1. 요청된 mode로 시도
  let data = await fetchGoogleDirections(origin, destination, mode, apiKey);
  let usedMode = mode;

  // 2. 실패 시 transit fallback
  if (!data && mode !== "transit") {
    data = await fetchGoogleDirections(origin, destination, "transit", apiKey);
    usedMode = "transit";
  }

  // 3. transit도 실패 → Haversine 추정
  if (!data) {
    const [lat1, lng1] = origin.split(",").map(Number);
    const [lat2, lng2] = destination.split(",").map(Number);
    const dist = Math.round(haversineDistance(lat1, lng1, lat2, lng2));
    const dur = estimateDuration(dist, mode);

    return {
      duration_seconds: dur,
      distance_meters: dist,
      duration_text: formatDurationText(dur),
      distance_text: formatDistanceText(dist),
      summary: null,
      estimated: true,
      used_mode: mode,
    };
  }

  const leg = data.routes[0].legs[0];
  return {
    duration_seconds: leg.duration.value,
    distance_meters: leg.distance.value,
    duration_text: leg.duration.text,
    distance_text: leg.distance.text,
    summary: data.routes[0].summary || null,
    estimated: false,
    used_mode: usedMode,
  };
}
