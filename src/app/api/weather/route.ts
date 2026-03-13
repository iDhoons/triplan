import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchWeatherForDateRange } from "@/lib/weather/client";

/**
 * GET /api/weather?tripId=xxx
 *
 * 여행의 날짜별 날씨를 Open-Meteo에서 가져와 schedules 테이블에 저장한다.
 * - 인증 필수
 * - 대표 좌표: 등록된 장소 중 첫 번째 좌표 있는 장소, 없으면 destination geocoding
 * - TTL: 7일 이내(3시간), 7~16일(12시간)
 * - Open-Meteo 예보 범위(16일) 초과 시 skip
 */

function getTTLMs(daysUntil: number): number {
  if (daysUntil <= 7) return 3 * 60 * 60 * 1000; // 3시간
  if (daysUntil <= 16) return 12 * 60 * 60 * 1000; // 12시간
  return 7 * 24 * 60 * 60 * 1000; // 7일
}

export async function GET(request: Request) {
  // 1. 인증 확인
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
  }

  // 2. 입력 파싱
  const { searchParams } = new URL(request.url);
  const tripId = searchParams.get("tripId");
  if (!tripId) {
    return NextResponse.json(
      { error: "tripId 파라미터가 필요합니다" },
      { status: 400 }
    );
  }

  // 3. 여행 정보 조회
  const { data: trip, error: tripError } = await supabase
    .from("trips")
    .select("id, start_date, end_date, destination")
    .eq("id", tripId)
    .single();

  if (tripError || !trip) {
    return NextResponse.json(
      { error: "여행을 찾을 수 없습니다" },
      { status: 404 }
    );
  }

  // 4. 예보 범위 확인 (16일 초과면 skip)
  const today = new Date();
  const startDate = new Date(trip.start_date);
  const endDate = new Date(trip.end_date);
  const daysUntilStart = Math.ceil(
    (startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysUntilStart > 16) {
    return NextResponse.json({
      status: "out_of_range",
      message: "예보 범위(16일)를 초과합니다",
      forecasts: [],
    });
  }

  // 5. 캐시 확인 — schedules의 weather_fetched_at
  const { data: schedules } = await supabase
    .from("schedules")
    .select("id, date, weather_summary, weather_fetched_at")
    .eq("trip_id", tripId)
    .order("date", { ascending: true });

  if (!schedules || schedules.length === 0) {
    return NextResponse.json({
      status: "no_schedules",
      message: "일정이 없습니다",
      forecasts: [],
    });
  }

  // 캐시 유효한지 확인 (첫 번째 schedule 기준)
  const firstSchedule = schedules[0];
  if (firstSchedule.weather_fetched_at) {
    const fetchedAt = new Date(firstSchedule.weather_fetched_at).getTime();
    const ttl = getTTLMs(daysUntilStart);
    if (Date.now() - fetchedAt < ttl) {
      // 캐시 유효 → 기존 데이터 반환
      return NextResponse.json({
        status: "cached",
        forecasts: schedules.map((s) => ({
          date: s.date,
          ...(s.weather_summary ?? {}),
        })),
      });
    }
  }

  // 6. 대표 좌표 추출 (등록된 장소 중 좌표 있는 첫 번째)
  const { data: places } = await supabase
    .from("places")
    .select("latitude, longitude")
    .eq("trip_id", tripId)
    .not("latitude", "is", null)
    .not("longitude", "is", null)
    .limit(1);

  let lat: number | null = null;
  let lng: number | null = null;

  if (places && places.length > 0) {
    lat = places[0].latitude;
    lng = places[0].longitude;
  }

  if (lat == null || lng == null) {
    // 좌표 없으면 Open-Meteo Geocoding으로 destination 검색
    try {
      const geoRes = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(trip.destination)}&count=1&language=ko`,
        { signal: AbortSignal.timeout(5000) }
      );
      if (geoRes.ok) {
        const geoData = await geoRes.json();
        if (geoData.results?.length > 0) {
          lat = geoData.results[0].latitude;
          lng = geoData.results[0].longitude;
        }
      }
    } catch {
      // geocoding 실패는 무시
    }
  }

  if (lat == null || lng == null) {
    return NextResponse.json({
      status: "no_coordinates",
      message: "좌표를 확인할 수 없습니다",
      forecasts: [],
    });
  }

  // 7. Open-Meteo API 호출
  // 예보 가능 범위로 클램프 (오늘 ~ 최대 16일 후)
  const forecastStart =
    startDate < today ? today.toISOString().slice(0, 10) : trip.start_date;
  const maxForecastDate = new Date(today);
  maxForecastDate.setDate(maxForecastDate.getDate() + 16);
  const forecastEnd =
    endDate > maxForecastDate
      ? maxForecastDate.toISOString().slice(0, 10)
      : trip.end_date;

  try {
    const forecasts = await fetchWeatherForDateRange(
      lat,
      lng,
      forecastStart,
      forecastEnd
    );

    // 8. schedules 테이블에 날씨 데이터 업데이트
    const now = new Date().toISOString();
    const forecastMap = new Map(forecasts.map((f) => [f.date, f]));

    await Promise.all(
      schedules.map((s) => {
        const forecast = forecastMap.get(s.date);
        if (!forecast) {
          // 예보 범위 밖이면 fetched_at만 갱신 (재호출 방지)
          return supabase
            .from("schedules")
            .update({ weather_fetched_at: now })
            .eq("id", s.id);
        }
        const { date: _, ...summary } = forecast;
        return supabase
          .from("schedules")
          .update({
            weather_summary: summary,
            weather_fetched_at: now,
          })
          .eq("id", s.id);
      })
    );

    // 9. 응답
    return NextResponse.json({
      status: "updated",
      forecasts: schedules.map((s) => {
        const forecast = forecastMap.get(s.date);
        return {
          date: s.date,
          ...(forecast
            ? {
                weather_code: forecast.weather_code,
                label: forecast.label,
                temp_high: forecast.temp_high,
                temp_low: forecast.temp_low,
                precip_pct: forecast.precip_pct,
                precip_mm: forecast.precip_mm,
                icon: forecast.icon,
              }
            : {}),
        };
      }),
    });
  } catch (err) {
    console.error("[weather]", err);
    return NextResponse.json(
      { error: "날씨 정보를 가져오는데 실패했습니다" },
      { status: 500 }
    );
  }
}
