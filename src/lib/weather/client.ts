import { type DailyWeather, type HalfDayWeather, getWeatherMeta } from "./types";
import { fetchWithRetry } from "@/lib/api/fetch-with-retry";

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

interface OpenMeteoHourly {
  time: string[];
  weather_code: number[];
  temperature_2m: number[];
}

interface OpenMeteoResponse {
  daily: OpenMeteoDaily;
  hourly?: OpenMeteoHourly;
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
  url.searchParams.set("hourly", "weather_code,temperature_2m");
  url.searchParams.set("timezone", "auto");

  const res = await fetchWithRetry(url.toString(), {}, { timeoutMs: 10000 });

  if (!res.ok) {
    throw new Error(`Open-Meteo API error: ${res.status}`);
  }

  const data: OpenMeteoResponse = await res.json();
  return mapResponse(data);
}

/** 특정 날짜+시각의 hourly 데이터에서 HalfDayWeather 추출 */
function extractHalfDay(
  hourly: OpenMeteoHourly,
  date: string,
  hour: number
): HalfDayWeather | undefined {
  const target = `${date}T${String(hour).padStart(2, "0")}:00`;
  const idx = hourly.time.indexOf(target);
  if (idx === -1) return undefined;

  const code = hourly.weather_code[idx];
  const meta = getWeatherMeta(code);
  return {
    weather_code: code,
    label: meta.label,
    icon: meta.icon,
    temp: Math.round(hourly.temperature_2m[idx]),
  };
}

function mapResponse(data: OpenMeteoResponse): DailyWeather[] {
  const { daily, hourly } = data;
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
      am: hourly ? extractHalfDay(hourly, date, 9) : undefined,
      pm: hourly ? extractHalfDay(hourly, date, 15) : undefined,
    };
  });
}
