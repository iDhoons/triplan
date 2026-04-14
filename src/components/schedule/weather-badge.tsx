"use client";

import type { WeatherSummary } from "@/types/database";

interface WeatherBadgeProps {
  weather: WeatherSummary | null;
}

export function WeatherBadge({ weather }: WeatherBadgeProps) {
  if (!weather) return null;

  const hasHalfDay = weather.am || weather.pm;

  // 오전/오후 데이터가 있으면 분리 표시
  if (hasHalfDay) {
    return (
      <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
        {weather.am && (
          <span className="inline-flex items-center gap-0.5" title={`오전: ${weather.am.label}`}>
            <span className="text-base leading-none">{weather.am.icon}</span>
            <span>{weather.am.temp}°</span>
          </span>
        )}
        {weather.am && weather.pm && (
          <span className="text-muted-foreground/40">/</span>
        )}
        {weather.pm && (
          <span className="inline-flex items-center gap-0.5" title={`오후: ${weather.pm.label}`}>
            <span className="text-base leading-none">{weather.pm.icon}</span>
            <span>{weather.pm.temp}°</span>
          </span>
        )}
      </div>
    );
  }

  // 폴백: 기존 daily 데이터만 있을 때
  const isRainy = weather.precip_pct >= 60;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
        isRainy
          ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
          : "bg-muted text-muted-foreground"
      }`}
      title={`${weather.label} · 최고 ${weather.temp_high}° / 최저 ${weather.temp_low}° · 강수확률 ${weather.precip_pct}%`}
    >
      <span className="text-sm leading-none">{weather.icon}</span>
      <span>{weather.temp_high}°</span>
      {isRainy && (
        <span className="opacity-70">💧{weather.precip_pct}%</span>
      )}
    </span>
  );
}
