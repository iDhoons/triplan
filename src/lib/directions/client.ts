/**
 * Google Routes API Gateway (Anti-Corruption Layer)
 *
 * Directions API → Routes API 마이그레이션 완료 (비용 절반, 더 강력한 응답).
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

export interface TransitDetail {
  line_name: string;
  line_short_name: string | null;
  line_color: string | null;
  vehicle_type: string;
  departure_stop: string;
  arrival_stop: string;
  num_stops: number;
}

export interface DirectionStep {
  travel_mode: string;
  duration_seconds: number;
  duration_text: string;
  distance_meters: number;
  distance_text: string;
  instruction: string;
  transit_details?: TransitDetail;
  start_location?: { lat: number; lng: number };
  end_location?: { lat: number; lng: number };
  polyline?: string;
}

export interface DirectionsResult {
  duration_seconds: number;
  distance_meters: number;
  duration_text: string;
  distance_text: string;
  summary: string | null;
  estimated: boolean;
  used_mode: string;
  steps?: DirectionStep[];
  overview_polyline?: string;
}

// -----------------------------------------------------------------------
// Google Routes API 호출
// -----------------------------------------------------------------------

const ROUTES_API_URL = "https://routes.googleapis.com/directions/v2:computeRoutes";

const MODE_MAP: Record<string, string> = {
  walking: "WALK",
  transit: "TRANSIT",
  driving: "DRIVE",
};

const FIELD_MASK = [
  "routes.duration",
  "routes.distanceMeters",
  "routes.polyline",
  "routes.description",
  "routes.legs.duration",
  "routes.legs.distanceMeters",
  "routes.legs.steps.travelMode",
  "routes.legs.steps.staticDuration",
  "routes.legs.steps.distanceMeters",
  "routes.legs.steps.polyline",
  "routes.legs.steps.startLocation",
  "routes.legs.steps.endLocation",
  "routes.legs.steps.navigationInstruction",
  "routes.legs.steps.transitDetails",
].join(",");

interface RoutesApiRoute {
  duration: string;           // "1234s"
  distanceMeters: number;
  polyline?: { encodedPolyline: string };
  description?: string;
  legs: {
    duration: string;
    distanceMeters: number;
    steps?: {
      travelMode: string;
      staticDuration: string;
      distanceMeters?: number;
      polyline?: { encodedPolyline: string };
      startLocation?: { latLng: { latitude: number; longitude: number } };
      endLocation?: { latLng: { latitude: number; longitude: number } };
      navigationInstruction?: { instructions: string };
      transitDetails?: {
        stopDetails?: {
          departureStop?: { name: string };
          arrivalStop?: { name: string };
        };
        transitLine?: {
          name: string;
          nameShort?: string;
          color?: string;
          vehicle?: { type: string };
        };
        stopCount?: number;
      };
    }[];
  }[];
}

/** "1234s" → 1234 */
function parseDuration(d: string | undefined): number {
  if (!d) return 0;
  return parseInt(d, 10) || 0;
}

async function fetchRoutesApi(
  origin: string,
  destination: string,
  mode: string,
  apiKey: string
): Promise<RoutesApiRoute | null> {
  const [lat1, lng1] = origin.split(",").map(Number);
  const [lat2, lng2] = destination.split(",").map(Number);

  const body = {
    origin: { location: { latLng: { latitude: lat1, longitude: lng1 } } },
    destination: { location: { latLng: { latitude: lat2, longitude: lng2 } } },
    travelMode: MODE_MAP[mode] ?? "TRANSIT",
    languageCode: "ko",
    computeAlternativeRoutes: false,
  };

  const res = await fetch(ROUTES_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) return null;
  const data = await res.json();
  return data.routes?.[0] ?? null;
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
 * Google Routes API 사용 (Directions API 대비 비용 절반).
 *
 * @param origin "lat,lng" 형식
 * @param destination "lat,lng" 형식
 * @param mode "walking" | "transit" | "driving"
 * @param apiKey Google API 키 (Routes API 활성화 필요)
 */
export async function getDirections(
  origin: string,
  destination: string,
  mode: string,
  apiKey: string
): Promise<DirectionsResult> {
  // 1. 요청된 mode로 시도
  let route = await fetchRoutesApi(origin, destination, mode, apiKey);
  let usedMode = mode;

  // 2. 실패 시 transit fallback
  if (!route && mode !== "transit") {
    route = await fetchRoutesApi(origin, destination, "transit", apiKey);
    usedMode = "transit";
  }

  // 3. transit도 실패 → Haversine 추정
  if (!route) {
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

  const leg = route.legs[0];
  const durationSeconds = parseDuration(leg.duration);

  const steps: DirectionStep[] | undefined = leg.steps?.map((s) => {
    const stepDuration = parseDuration(s.staticDuration);
    const stepDistance = s.distanceMeters ?? 0;
    return {
      travel_mode: s.travelMode,
      duration_seconds: stepDuration,
      duration_text: formatDurationText(stepDuration),
      distance_meters: stepDistance,
      distance_text: formatDistanceText(stepDistance),
      instruction: s.navigationInstruction?.instructions ?? "",
      ...(s.transitDetails?.transitLine
        ? {
            transit_details: {
              line_name: s.transitDetails.transitLine.name ?? "",
              line_short_name: s.transitDetails.transitLine.nameShort ?? null,
              line_color: s.transitDetails.transitLine.color ?? null,
              vehicle_type: s.transitDetails.transitLine.vehicle?.type ?? "",
              departure_stop: s.transitDetails.stopDetails?.departureStop?.name ?? "",
              arrival_stop: s.transitDetails.stopDetails?.arrivalStop?.name ?? "",
              num_stops: s.transitDetails.stopCount ?? 0,
            },
          }
        : {}),
      start_location: s.startLocation?.latLng
        ? { lat: s.startLocation.latLng.latitude, lng: s.startLocation.latLng.longitude }
        : undefined,
      end_location: s.endLocation?.latLng
        ? { lat: s.endLocation.latLng.latitude, lng: s.endLocation.latLng.longitude }
        : undefined,
      polyline: s.polyline?.encodedPolyline,
    };
  });

  return {
    duration_seconds: durationSeconds,
    distance_meters: leg.distanceMeters ?? 0,
    duration_text: formatDurationText(durationSeconds),
    distance_text: formatDistanceText(leg.distanceMeters ?? 0),
    summary: route.description ?? null,
    estimated: false,
    used_mode: usedMode,
    steps,
    overview_polyline: route.polyline?.encodedPolyline,
  };
}
