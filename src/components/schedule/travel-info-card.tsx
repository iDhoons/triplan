"use client";

import { useState, useEffect, useRef } from "react";
import {
  Footprints,
  Bus,
  Car,
  ArrowDown,
  Loader2,
  ExternalLink,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { loadGoogleMaps, hasApiKey } from "@/lib/maps/google-maps";
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

function getModeIcon(mode: TravelMode | null, className = "w-3 h-3") {
  switch (mode) {
    case "walking":
      return <Footprints className={className} />;
    case "transit":
      return <Bus className={className} />;
    case "driving":
      return <Car className={className} />;
    default:
      return <Bus className={className} />;
  }
}

function getModeLabel(mode: TravelMode | null): string {
  switch (mode) {
    case "walking": return "도보";
    case "transit": return "대중교통";
    case "driving": return "자동차";
    default: return "대중교통";
  }
}

/** Google Maps 딥링크 URL 생성 */
function buildGoogleMapsUrl(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number,
  mode: TravelMode | null
): string {
  const travelMode = mode || "transit";
  return `https://www.google.com/maps/dir/?api=1&origin=${originLat},${originLng}&destination=${destLat},${destLng}&travelmode=${travelMode}`;
}

// -----------------------------------------------------------------------
// Inline Mini Map (출발/도착 마커 2개)
// -----------------------------------------------------------------------
interface MiniMapProps {
  originLat: number;
  originLng: number;
  destLat: number;
  destLng: number;
  originLabel: string;
  destLabel: string;
}

function MiniMap({ originLat, originLng, destLat, destLng, originLabel, destLabel }: MiniMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!hasApiKey()) return;

    let cancelled = false;

    async function init() {
      try {
        await loadGoogleMaps();
        if (cancelled || !mapRef.current) return;

        const bounds = new google.maps.LatLngBounds();
        const origin = { lat: originLat, lng: originLng };
        const dest = { lat: destLat, lng: destLng };
        bounds.extend(origin);
        bounds.extend(dest);

        const map = new google.maps.Map(mapRef.current, {
          center: bounds.getCenter(),
          zoom: 14,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          zoomControl: false,
          gestureHandling: "none",
          clickableIcons: false,
        });

        map.fitBounds(bounds, 40);
        mapInstanceRef.current = map;

        // 출발 마커
        new google.maps.Marker({
          position: origin,
          map,
          title: originLabel,
          label: { text: "A", color: "#fff", fontWeight: "bold", fontSize: "11px" },
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 12,
            fillColor: "#3b82f6",
            fillOpacity: 1,
            strokeColor: "#1d4ed8",
            strokeWeight: 2,
          },
        });

        // 도착 마커
        new google.maps.Marker({
          position: dest,
          map,
          title: destLabel,
          label: { text: "B", color: "#fff", fontWeight: "bold", fontSize: "11px" },
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 12,
            fillColor: "#ef4444",
            fillOpacity: 1,
            strokeColor: "#dc2626",
            strokeWeight: 2,
          },
        });

        // 점선 연결
        new google.maps.Polyline({
          path: [origin, dest],
          geodesic: true,
          strokeColor: "#6b7280",
          strokeOpacity: 0,
          icons: [{
            icon: { path: "M 0,-1 0,1", strokeOpacity: 0.4, scale: 3 },
            offset: "0",
            repeat: "12px",
          }],
          map,
        });

        setLoaded(true);
      } catch (e) {
        console.error("[MiniMap]", e);
      }
    }

    init();
    return () => { cancelled = true; };
  }, [originLat, originLng, destLat, destLng, originLabel, destLabel]);

  if (!hasApiKey()) {
    return (
      <div className="h-32 rounded-lg bg-muted/50 flex items-center justify-center text-xs text-muted-foreground">
        지도 API 키가 필요합니다
      </div>
    );
  }

  return (
    <div className="relative h-32 rounded-lg overflow-hidden border">
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/50 z-10">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        </div>
      )}
      <div ref={mapRef} className="h-full w-full" />
    </div>
  );
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
  const [expanded, setExpanded] = useState(false);

  const duration = nextItem.travel_duration_seconds;
  const distance = nextItem.travel_distance_meters;
  const mode = nextItem.travel_mode;

  const hasCoords =
    currentItem.place?.latitude != null &&
    currentItem.place?.longitude != null &&
    nextItem.place?.latitude != null &&
    nextItem.place?.longitude != null;

  const hasCachedInfo = duration != null && distance != null;

  // Loading 상태
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

  // 이동 정보 없음 + 좌표 없음 → 단순 구분선
  if (!hasCachedInfo && !hasCoords) {
    return (
      <div className="flex items-center gap-2 py-1 pl-4">
        <div className="flex-1 border-t border-dashed border-muted-foreground/20" />
        <ArrowDown className="w-3 h-3 text-muted-foreground/40" />
        <div className="flex-1 border-t border-dashed border-muted-foreground/20" />
      </div>
    );
  }

  // 캐싱된 이동 정보가 있을 때 → 탭 가능 pill + accordion
  if (hasCachedInfo) {
    return (
      <div className="space-y-0">
        {/* Pill — 탭하면 확장 */}
        <div className="flex items-center gap-2 py-1.5 pl-4">
          <div className="flex-1 border-t border-dashed border-muted-foreground/20" />
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-2.5 py-0.5",
              "bg-muted text-muted-foreground text-xs",
              "hover:bg-muted/80 transition-colors cursor-pointer",
              "active:scale-95 transition-transform"
            )}
          >
            {getModeIcon(mode)}
            <span className="font-medium">{formatDuration(duration)}</span>
            <span className="text-muted-foreground/60">&middot;</span>
            <span>{formatDistance(distance)}</span>
            <ChevronDown
              className={cn(
                "w-3 h-3 transition-transform duration-200",
                expanded && "rotate-180"
              )}
            />
          </button>
          <div className="flex-1 border-t border-dashed border-muted-foreground/20" />
        </div>

        {/* Accordion 확장 영역 */}
        {expanded && (
          <div className="mx-4 mb-2 space-y-2 animate-in slide-in-from-top-1 duration-200">
            {/* 미니맵 */}
            {hasCoords && (
              <MiniMap
                originLat={currentItem.place!.latitude!}
                originLng={currentItem.place!.longitude!}
                destLat={nextItem.place!.latitude!}
                destLng={nextItem.place!.longitude!}
                originLabel={currentItem.title}
                destLabel={nextItem.title}
              />
            )}

            {/* 경로 정보 요약 */}
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {getModeIcon(mode, "w-3.5 h-3.5")}
                <span>
                  {getModeLabel(mode)} {formatDuration(duration)} &middot; {formatDistance(distance)}
                </span>
              </div>

              {/* Google Maps 딥링크 버튼 */}
              {hasCoords && (
                <a
                  href={buildGoogleMapsUrl(
                    currentItem.place!.latitude!,
                    currentItem.place!.longitude!,
                    nextItem.place!.latitude!,
                    nextItem.place!.longitude!,
                    mode
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    "inline-flex items-center gap-1.5 h-7 px-3 text-xs font-medium",
                    "rounded-md border bg-background hover:bg-accent transition-colors"
                  )}
                >
                  <ExternalLink className="w-3 h-3" />
                  Google Maps에서 길찾기
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // 좌표 있지만 미계산 → 탭하면 Google Maps 딥링크만
  return (
    <div className="space-y-0">
      <div className="flex items-center gap-2 py-1 pl-4">
        <div className="flex-1 border-t border-dashed border-muted-foreground/20" />
        {hasCoords ? (
          <a
            href={buildGoogleMapsUrl(
              currentItem.place!.latitude!,
              currentItem.place!.longitude!,
              nextItem.place!.latitude!,
              nextItem.place!.longitude!,
              null
            )}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[10px] text-muted-foreground/60 hover:text-primary transition-colors"
          >
            <ExternalLink className="w-2.5 h-2.5" />
            길찾기
          </a>
        ) : (
          <span className="text-[10px] text-muted-foreground/50">이동 정보 미계산</span>
        )}
        <div className="flex-1 border-t border-dashed border-muted-foreground/20" />
      </div>
    </div>
  );
}
