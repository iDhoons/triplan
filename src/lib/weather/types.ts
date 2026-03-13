/** Open-Meteo daily forecast 도메인 타입 */
export interface DailyWeather {
  date: string;
  weather_code: number;
  label: string;
  temp_high: number;
  temp_low: number;
  precip_pct: number;
  precip_mm: number;
  icon: string;
}

/** WMO Weather Code → 한국어 라벨 + 아이콘 매핑 */
const WMO_MAP: Record<number, { label: string; icon: string }> = {
  0: { label: "맑음", icon: "☀️" },
  1: { label: "대체로 맑음", icon: "🌤" },
  2: { label: "구름 조금", icon: "⛅" },
  3: { label: "흐림", icon: "☁️" },
  45: { label: "안개", icon: "🌫" },
  48: { label: "짙은 안개", icon: "🌫" },
  51: { label: "이슬비", icon: "🌦" },
  53: { label: "이슬비", icon: "🌦" },
  55: { label: "이슬비", icon: "🌧" },
  56: { label: "얼어붙는 이슬비", icon: "🌧" },
  57: { label: "얼어붙는 이슬비", icon: "🌧" },
  61: { label: "약한 비", icon: "🌦" },
  63: { label: "비", icon: "🌧" },
  65: { label: "강한 비", icon: "🌧" },
  66: { label: "얼어붙는 비", icon: "🌧" },
  67: { label: "강한 얼어붙는 비", icon: "🌧" },
  71: { label: "약한 눈", icon: "🌨" },
  73: { label: "눈", icon: "❄️" },
  75: { label: "강한 눈", icon: "❄️" },
  77: { label: "싸락눈", icon: "🌨" },
  80: { label: "소나기", icon: "🌦" },
  81: { label: "소나기", icon: "🌧" },
  82: { label: "강한 소나기", icon: "🌧" },
  85: { label: "눈 소나기", icon: "🌨" },
  86: { label: "강한 눈 소나기", icon: "❄️" },
  95: { label: "뇌우", icon: "⛈" },
  96: { label: "우박 뇌우", icon: "⛈" },
  99: { label: "강한 우박 뇌우", icon: "⛈" },
};

export function getWeatherMeta(code: number): { label: string; icon: string } {
  return WMO_MAP[code] ?? { label: "알 수 없음", icon: "❓" };
}
