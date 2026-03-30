"use client";

import { memo, useState } from "react";
import {
  Footprints,
  Bus,
  Car,
  ArrowDown,
  Loader2,
  ExternalLink,
  ChevronDown,
  TrainFront,
} from "lucide-react";
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

function getModeIcon(mode: TravelMode | null, className = "w-3 h-3") {
  switch (mode) {
    case "walking":
      return <Footprints className={className} />;
    case "driving":
      return <Car className={className} />;
    default:
      return <Bus className={className} />;
  }
}

/** 대중교통 차량 타입 아이콘 */
function getVehicleIcon(
  vehicleType: string | undefined,
  className = "w-3.5 h-3.5"
) {
  switch (vehicleType) {
    case "SUBWAY":
    case "METRO_RAIL":
    case "HEAVY_RAIL":
    case "COMMUTER_TRAIN":
    case "HIGH_SPEED_TRAIN":
      return <TrainFront className={className} />;
    default:
      return <Bus className={className} />;
  }
}

/** Google Maps 딥링크 URL */
function buildGoogleMapsUrl(
  origin: { name: string; lat: number; lng: number; placeId?: string | null },
  dest: { name: string; lat: number; lng: number; placeId?: string | null },
  mode: TravelMode | null
): string {
  const params = new URLSearchParams({
    api: "1",
    origin: origin.name,
    destination: dest.name,
    travelmode: mode || "transit",
  });
  if (origin.placeId) params.set("origin_place_id", origin.placeId);
  if (dest.placeId) params.set("destination_place_id", dest.placeId);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

// -----------------------------------------------------------------------
// 대중교통 노선 요약 추출
// -----------------------------------------------------------------------
interface TransitLine {
  name: string;
  short_name: string | null;
  color: string | null;
  vehicle_type: string;
  departure_stop: string;
  arrival_stop: string;
  num_stops: number;
  duration_seconds: number;
  start_location?: { lat: number; lng: number };
  end_location?: { lat: number; lng: number };
}

function extractTransitLines(
  steps?: {
    travel_mode: string;
    duration_seconds: number;
    transit_details?: Omit<TransitLine, "start_location" | "end_location" | "duration_seconds">;
    start_location?: { lat: number; lng: number };
    end_location?: { lat: number; lng: number };
  }[]
): TransitLine[] {
  if (!steps) return [];
  return steps
    .filter((s) => s.travel_mode === "TRANSIT" && s.transit_details)
    .map((s) => ({
      ...s.transit_details!,
      duration_seconds: s.duration_seconds,
      start_location: s.start_location,
      end_location: s.end_location,
    }));
}

// -----------------------------------------------------------------------
// Transit Summary (핵심 환승 노선만 한 줄)
// -----------------------------------------------------------------------
function TransitSummary({ lines }: { lines: TransitLine[] }) {
  if (lines.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      {lines.map((line, i) => (
        <div key={i} className="flex items-start gap-2">
          {/* 노선 색상 바 */}
          <div
            className="w-1 self-stretch rounded-full shrink-0 mt-0.5"
            style={{ backgroundColor: line.color || "#6b7280" }}
          />
          <div className="flex flex-col gap-0.5 min-w-0">
            {/* 노선 이름 + 소요 시간 */}
            <div className="flex items-center gap-1.5">
              {getVehicleIcon(line.vehicle_type, "w-4 h-4 shrink-0")}
              <span className="text-sm font-semibold">
                {line.short_name || line.name}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatDuration(line.duration_seconds)}
              </span>
            </div>
            {/* 구간 + 정거장 */}
            <p className="text-xs text-muted-foreground leading-relaxed">
              {line.departure_stop} → {line.arrival_stop} · {line.num_stops}정거장
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

// -----------------------------------------------------------------------
// Static Map Image (Google Static Maps API — JS 0줄, img 1개)
// -----------------------------------------------------------------------
function StaticMapImage({
  origin,
  destination,
  polyline,
  transitLines,
  googleMapsUrl,
}: {
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  polyline?: string;
  transitLines?: TransitLine[];
  googleMapsUrl: string;
}) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) return null;

  const params = new URLSearchParams({
    size: "600x200",
    scale: "2",
    maptype: "roadmap",
    key: apiKey,
  });

  // 출발/도착 마커
  params.append("markers", `color:0x3b82f6|label:A|${origin.lat},${origin.lng}`);
  params.append("markers", `color:0xef4444|label:B|${destination.lat},${destination.lng}`);

  // 환승 지점 마커 (Static Maps는 이름 색상만 지원)
  const MARKER_COLORS = ["purple", "green", "orange", "yellow", "brown"];
  if (transitLines?.length) {
    for (let i = 0; i < transitLines.length; i++) {
      const line = transitLines[i];
      if (line.start_location) {
        const color = MARKER_COLORS[i % MARKER_COLORS.length];
        params.append(
          "markers",
          `color:${color}|size:small|label:${i + 1}|${line.start_location.lat},${line.start_location.lng}`
        );
      }
    }
  }

  // Static Maps API URL을 직접 구성 (URLSearchParams가 | 를 인코딩할 수 있으므로)
  let src = `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;

  // 경로선: style 파라미터 → enc:POLYLINE 순서 (enc는 반드시 마지막)
  if (polyline && polyline.length < 7000) {
    src += `&path=weight:4|color:0x4285F4FF|enc:${polyline}`;
  }

  return (
    <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer" className="block">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt="경로 지도"
        className="w-full h-32 sm:h-40 rounded-lg object-cover"
        loading="lazy"
      />
    </a>
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

export const TravelInfoCard = memo(function TravelInfoCard({
  currentItem,
  nextItem,
  loading,
}: TravelInfoCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [fetchedInfo, setFetchedInfo] = useState<{
    duration: number;
    distance: number;
    mode: TravelMode;
    transitLines: TransitLine[];
    polyline?: string;
  } | null>(null);

  // 캐시된 이동 정보 (DB)
  const [cachedTransitLines, setCachedTransitLines] = useState<
    TransitLine[] | null
  >(null);
  const [cachedPolyline, setCachedPolyline] = useState<string | undefined>();
  const [fetchingLines, setFetchingLines] = useState(false);

  const duration = nextItem.travel_duration_seconds;
  const distance = nextItem.travel_distance_meters;
  const mode = nextItem.travel_mode;

  const hasCoords =
    currentItem.place?.latitude != null &&
    currentItem.place?.longitude != null &&
    nextItem.place?.latitude != null &&
    nextItem.place?.longitude != null;

  const hasCachedInfo = duration != null && distance != null;

  const googleMapsUrl =
    hasCoords
      ? buildGoogleMapsUrl(
          {
            name: currentItem.title,
            lat: currentItem.place!.latitude!,
            lng: currentItem.place!.longitude!,
            placeId: currentItem.place!.google_place_id,
          },
          {
            name: nextItem.title,
            lat: nextItem.place!.latitude!,
            lng: nextItem.place!.longitude!,
            placeId: nextItem.place!.google_place_id,
          },
          mode ?? fetchedInfo?.mode ?? null
        )
      : null;

  /** 캐시된 아이템 확장 시 환승 노선만 조회 */
  async function fetchTransitLines() {
    if (!hasCoords || fetchingLines || cachedTransitLines) return;
    setFetchingLines(true);
    try {
      const res = await fetch(
        `/api/directions?origin=${currentItem.place!.latitude},${currentItem.place!.longitude}&destination=${nextItem.place!.latitude},${nextItem.place!.longitude}&mode=${mode || "transit"}`
      );
      if (res.ok) {
        const data = await res.json();
        setCachedTransitLines(extractTransitLines(data.steps));
        setCachedPolyline(data.overview_polyline);
      }
    } catch {
      // 실패 시 무시
    } finally {
      setFetchingLines(false);
    }
  }

  /** 미계산 상태에서 길찾기 */
  async function fetchDirections() {
    if (!hasCoords || fetching) return;
    setFetching(true);
    try {
      const res = await fetch(
        `/api/directions?origin=${currentItem.place!.latitude},${currentItem.place!.longitude}&destination=${nextItem.place!.latitude},${nextItem.place!.longitude}&mode=transit`
      );
      if (res.ok) {
        const data = await res.json();
        setFetchedInfo({
          duration: data.duration_seconds,
          distance: data.distance_meters,
          mode: data.used_mode || "transit",
          transitLines: extractTransitLines(data.steps),
          polyline: data.overview_polyline,
        });
        setExpanded(true);
      }
    } catch {
      // 실패 시 무시
    } finally {
      setFetching(false);
    }
  }

  /** 캐시된 아이템 확장 토글 */
  function handleCachedExpand() {
    const willExpand = !expanded;
    setExpanded(willExpand);
    if (willExpand) fetchTransitLines();
  }

  // Loading
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

  // 좌표 없음 → 단순 구분선
  if (!hasCachedInfo && !hasCoords) {
    return (
      <div className="flex items-center gap-2 py-1 pl-4">
        <div className="flex-1 border-t border-dashed border-muted-foreground/20" />
        <ArrowDown className="w-3 h-3 text-muted-foreground/40" />
        <div className="flex-1 border-t border-dashed border-muted-foreground/20" />
      </div>
    );
  }

  // 확장 영역: 환승 요약 + 지도 + Google Maps 링크
  function renderExpanded(transitLines: TransitLine[], polyline?: string) {
    return (
      <div className="mx-4 mb-2 space-y-2 animate-in slide-in-from-top-1 duration-200">
        {/* 노선 + 지도: 모바일 상하, 데스크톱 좌우 */}
        <div className="flex flex-col md:flex-row gap-2">
          {/* 왼쪽: 환승 노선 요약 */}
          <div className="flex-1 min-w-0">
            {fetchingLines ? (
              <div className="flex items-center gap-1.5 py-2">
                <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                <span className="text-xs text-muted-foreground">노선 조회 중...</span>
              </div>
            ) : transitLines.length > 0 ? (
              <div className="px-3 py-2 rounded-lg bg-muted/50 h-full">
                <TransitSummary lines={transitLines} />
              </div>
            ) : null}
          </div>

          {/* 오른쪽: Static Map */}
          {hasCoords && googleMapsUrl && (
            <div className="md:w-1/2 shrink-0">
              <StaticMapImage
                origin={{ lat: currentItem.place!.latitude!, lng: currentItem.place!.longitude! }}
                destination={{ lat: nextItem.place!.latitude!, lng: nextItem.place!.longitude! }}
                polyline={polyline}
                transitLines={transitLines}
                googleMapsUrl={googleMapsUrl}
              />
            </div>
          )}
        </div>

        {/* Google Maps 딥링크 */}
        {googleMapsUrl && (
          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "flex items-center justify-center gap-1.5 w-full h-8 text-xs font-medium",
              "rounded-md border bg-background hover:bg-accent transition-colors"
            )}
          >
            <ExternalLink className="w-3 h-3" />
            Google Maps에서 상세 경로 보기
          </a>
        )}
      </div>
    );
  }

  // --- Pill 공통 렌더링 ---
  function renderPill(
    displayMode: TravelMode | null,
    displayDuration: number,
    displayDistance: number,
    isExpanded: boolean,
    onClick: () => void
  ) {
    return (
      <div className="flex items-center gap-2 py-1.5 pl-4">
        <div className="flex-1 border-t border-dashed border-muted-foreground/20" />
        <button
          type="button"
          onClick={onClick}
          className={cn(
            "flex items-center gap-1.5 rounded-full px-2.5 py-0.5",
            "bg-muted text-muted-foreground text-xs",
            "hover:bg-muted/80 transition-colors cursor-pointer",
            "active:scale-95 transition-transform"
          )}
        >
          {getModeIcon(displayMode)}
          <span className="font-medium">{formatDuration(displayDuration)}</span>
          <span className="text-muted-foreground/60">&middot;</span>
          <span>{formatDistance(displayDistance)}</span>
          <ChevronDown
            className={cn(
              "w-3 h-3 transition-transform duration-200",
              isExpanded && "rotate-180"
            )}
          />
        </button>
        <div className="flex-1 border-t border-dashed border-muted-foreground/20" />
      </div>
    );
  }

  // 캐싱된 이동 정보
  if (hasCachedInfo) {
    return (
      <div className="space-y-0">
        {renderPill(mode, duration, distance, expanded, handleCachedExpand)}
        {expanded && renderExpanded(cachedTransitLines ?? [], cachedPolyline)}
      </div>
    );
  }

  // 미계산 → 길찾기 버튼
  return (
    <div className="space-y-0">
      <div className="flex items-center gap-2 py-1.5 pl-4">
        <div className="flex-1 border-t border-dashed border-muted-foreground/20" />
        {hasCoords ? (
          <button
            type="button"
            onClick={
              fetchedInfo
                ? () => setExpanded(!expanded)
                : fetchDirections
            }
            disabled={fetching}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-2.5 py-0.5",
              "text-xs transition-all",
              fetchedInfo
                ? "bg-muted text-muted-foreground hover:bg-muted/80 cursor-pointer"
                : "text-muted-foreground/60 hover:text-primary cursor-pointer",
              fetching && "opacity-60 cursor-wait"
            )}
          >
            {fetching ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>경로 조회 중...</span>
              </>
            ) : fetchedInfo ? (
              <>
                {getModeIcon(fetchedInfo.mode)}
                <span className="font-medium">
                  {formatDuration(fetchedInfo.duration)}
                </span>
                <span className="text-muted-foreground/60">&middot;</span>
                <span>{formatDistance(fetchedInfo.distance)}</span>
                <ChevronDown
                  className={cn(
                    "w-3 h-3 transition-transform duration-200",
                    expanded && "rotate-180"
                  )}
                />
              </>
            ) : (
              <>
                {getModeIcon(null, "w-2.5 h-2.5")}
                <span>길찾기</span>
              </>
            )}
          </button>
        ) : (
          <span className="text-[10px] text-muted-foreground/50">
            이동 정보 미계산
          </span>
        )}
        <div className="flex-1 border-t border-dashed border-muted-foreground/20" />
      </div>

      {fetchedInfo && expanded && renderExpanded(fetchedInfo.transitLines, fetchedInfo.polyline)}
    </div>
  );
});
