"use client";

import { Footprints, Bus, Car, ArrowDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ScheduleItem, TravelMode } from "@/types/database";

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------
function formatDuration(seconds: number): string {
  if (seconds < 60) return "1분 미만";
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  if (h > 0) return m > 0 ? `${h}시간 ${m}분` : `${h}시간`;
  return `${m}분`;
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${meters}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

function getModeIcon(mode: TravelMode | null) {
  switch (mode) {
    case "walking":
      return <Footprints className="w-3 h-3" />;
    case "transit":
      return <Bus className="w-3 h-3" />;
    case "driving":
      return <Car className="w-3 h-3" />;
    default:
      return <ArrowDown className="w-3 h-3" />;
  }
}

function getModeLabel(mode: TravelMode | null): string {
  switch (mode) {
    case "walking": return "도보";
    case "transit": return "대중교통";
    case "driving": return "자동차";
    default: return "";
  }
}

// -----------------------------------------------------------------------
// Travel Info Card
// -----------------------------------------------------------------------
interface TravelInfoCardProps {
  currentItem: ScheduleItem;
  nextItem: ScheduleItem;
  loading?: boolean;
}

export function TravelInfoCard({ currentItem, nextItem, loading }: TravelInfoCardProps) {
  // 다음 아이템에 이동 정보가 캐싱되어 있으면 표시
  const duration = nextItem.travel_duration_seconds;
  const distance = nextItem.travel_distance_meters;
  const mode = nextItem.travel_mode;

  // 양쪽 모두 좌표가 없고 캐싱된 이동 정보도 없으면 단순 구분선만
  const hasCoords =
    currentItem.place?.latitude != null &&
    currentItem.place?.longitude != null &&
    nextItem.place?.latitude != null &&
    nextItem.place?.longitude != null;

  const hasCachedInfo = duration != null && distance != null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-1.5">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="w-3 h-3 animate-spin" />
          <span>이동 정보 계산 중...</span>
        </div>
      </div>
    );
  }

  if (!hasCachedInfo && !hasCoords) {
    // 이동 정보 없음 — 심플 구분선
    return (
      <div className="flex items-center gap-2 py-1 pl-4">
        <div className="flex-1 border-t border-dashed border-muted-foreground/20" />
        <ArrowDown className="w-3 h-3 text-muted-foreground/40" />
        <div className="flex-1 border-t border-dashed border-muted-foreground/20" />
      </div>
    );
  }

  if (hasCachedInfo) {
    return (
      <div className="flex items-center gap-2 py-1.5 pl-4">
        <div className="flex-1 border-t border-dashed border-muted-foreground/20" />
        <div
          className={cn(
            "flex items-center gap-1.5 rounded-full px-2.5 py-0.5",
            "bg-muted text-muted-foreground text-xs"
          )}
        >
          {getModeIcon(mode)}
          <span className="font-medium">{formatDuration(duration)}</span>
          <span className="text-muted-foreground/60">·</span>
          <span>{formatDistance(distance)}</span>
          {mode && (
            <>
              <span className="text-muted-foreground/60">·</span>
              <span>{getModeLabel(mode)}</span>
            </>
          )}
        </div>
        <div className="flex-1 border-t border-dashed border-muted-foreground/20" />
      </div>
    );
  }

  // 좌표는 있지만 아직 계산되지 않음 — 계산 가능 표시
  return (
    <div className="flex items-center gap-2 py-1 pl-4">
      <div className="flex-1 border-t border-dashed border-muted-foreground/20" />
      <span className="text-[10px] text-muted-foreground/50">이동 정보 미계산</span>
      <div className="flex-1 border-t border-dashed border-muted-foreground/20" />
    </div>
  );
}
