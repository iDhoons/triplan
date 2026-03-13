"use client";

import type { WeatherSummary } from "@/types/database";

interface WeatherBadgeProps {
  weather: WeatherSummary | null;
}

export function WeatherBadge({ weather }: WeatherBadgeProps) {
  if (!weather) return null;

  const isRainy = weather.precip_pct >= 60;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
        isRainy
          ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
          : "bg-muted text-muted-foreground"
      }`}
      title={`${weather.label} · 최고 ${weather.temp_high}° / 최저 ${weather.temp_low}° · 강수확률 ${weather.precip_pct}%`}
    >
      <span>{weather.icon}</span>
      <span>{weather.temp_high}°</span>
      {isRainy && (
        <span className="opacity-70">💧{weather.precip_pct}%</span>
      )}
    </span>
  );
}
