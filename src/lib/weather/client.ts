import { type DailyWeather, getWeatherMeta } from "./types";

/**
 * Open-Meteo API Gateway
 * - API 키 불필요 (무료)
 * - 16일 예보 지원
 * - Anti-Corruption Layer: Open-Meteo 응답 → DailyWeather 도메인 타입
 */

interface OpenMeteoDaily {
  time: string[];
  weather_code: number[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  precipitation_probability_max: number[];
  precipitation_sum: number[];
}

interface OpenMeteoResponse {
  daily: OpenMeteoDaily;
}

export async function fetchWeatherForDateRange(
  latitude: number,
  longitude: number,
  startDate: string,
  endDate: string
): Promise<DailyWeather[]> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", latitude.toFixed(4));
  url.searchParams.set("longitude", longitude.toFixed(4));
  url.searchParams.set("start_date", startDate);
  url.searchParams.set("end_date", endDate);
  url.searchParams.set(
    "daily",
    "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum"
  );
  url.searchParams.set("timezone", "auto");

  const res = await fetch(url.toString(), {
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    throw new Error(`Open-Meteo API error: ${res.status}`);
  }

  const data: OpenMeteoResponse = await res.json();
  return mapResponse(data);
}

function mapResponse(data: OpenMeteoResponse): DailyWeather[] {
  const { daily } = data;
  return daily.time.map((date, i) => {
    const code = daily.weather_code[i];
    const meta = getWeatherMeta(code);
    return {
      date,
      weather_code: code,
      label: meta.label,
      temp_high: Math.round(daily.temperature_2m_max[i]),
      temp_low: Math.round(daily.temperature_2m_min[i]),
      precip_pct: daily.precipitation_probability_max[i] ?? 0,
      precip_mm: Math.round((daily.precipitation_sum[i] ?? 0) * 10) / 10,
      icon: meta.icon,
    };
  });
}
