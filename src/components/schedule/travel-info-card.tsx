"use client";

import { memo, useState, useEffect, useRef, useCallback } from "react";
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
import { loadGoogleMaps, hasApiKey } from "@/lib/maps/google-maps";
import type { ScheduleItem, TravelMode } from "@/types/database";

// -----------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------
interface RouteStep {
  travel_mode: string;
  duration_text: string;
  distance_text: string;
  duration_seconds: number;
  distance_meters: number;
  instruction: string;
  transit_details?: {
    line_name: string;
    line_short_name: string | null;
    line_color: string | null;
    vehicle_type: string;
    departure_stop: string;
    arrival_stop: string;
    num_stops: number;
  };
  start_location?: { lat: number; lng: number };
  end_location?: { lat: number; lng: number };
  polyline?: string;
}

interface RouteDetails {
  steps?: RouteStep[];
  overview_polyline?: string;
}

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
    case "walking":
      return "도보";
    case "transit":
      return "대중교통";
    case "driving":
      return "자동차";
    default:
      return "대중교통";
  }
}

/** Google Maps 딥링크 URL 생성 */
function buildGoogleMapsUrl(
  origin: { name: string; lat: number; lng: number; placeId?: string | null },
  dest: { name: string; lat: number; lng: number; placeId?: string | null },
  mode: TravelMode | null
): string {
  const travelMode = mode || "transit";
  const params = new URLSearchParams({
    api: "1",
    origin: origin.name,
    destination: dest.name,
    travelmode: travelMode,
  });
  if (origin.placeId) params.set("origin_place_id", origin.placeId);
  if (dest.placeId) params.set("destination_place_id", dest.placeId);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

/** Google Encoded Polyline 디코딩 */
function decodePolyline(encoded: string): Array<{ lat: number; lng: number }> {
  const points: Array<{ lat: number; lng: number }> = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let b: number;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }

  return points;
}

/** 대중교통 차량 타입에 맞는 아이콘 */
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
    case "BUS":
    case "INTERCITY_BUS":
    case "TROLLEYBUS":
      return <Bus className={className} />;
    default:
      return <Bus className={className} />;
  }
}

// -----------------------------------------------------------------------
// Step List (클릭 가능한 이동 단계 목록)
// -----------------------------------------------------------------------
interface StepListProps {
  steps: RouteStep[];
  selectedIndex: number | null;
  onStepClick: (index: number) => void;
}

function StepList({ steps, selectedIndex, onStepClick }: StepListProps) {
  return (
    <div className="rounded-lg border bg-card overflow-hidden divide-y divide-border">
      {steps.map((step, i) => {
        const hasLocation = !!(step.start_location || step.polyline);
        const isSelected = selectedIndex === i;

        if (step.travel_mode === "TRANSIT" && step.transit_details) {
          const td = step.transit_details;
          return (
            <button
              key={i}
              type="button"
              onClick={() => hasLocation && onStepClick(i)}
              className={cn(
                "flex items-start gap-2 px-3 py-2 w-full text-left transition-colors",
                hasLocation && "cursor-pointer hover:bg-accent/50",
                isSelected && "bg-primary/5 ring-1 ring-inset ring-primary/30"
              )}
            >
              <div
                className="w-1 self-stretch rounded-full shrink-0 mt-0.5"
                style={{ backgroundColor: td.line_color || "#6b7280" }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  {getVehicleIcon(td.vehicle_type, "w-3.5 h-3.5 shrink-0")}
                  <span className="text-xs font-semibold truncate">
                    {td.line_name}
                  </span>
                  {td.line_short_name &&
                    td.line_short_name !== td.line_name && (
                      <span
                        className="text-[10px] font-medium px-1.5 py-0.5 rounded-full text-white shrink-0"
                        style={{
                          backgroundColor: td.line_color || "#6b7280",
                        }}
                      >
                        {td.line_short_name}
                      </span>
                    )}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {td.departure_stop} → {td.arrival_stop}
                </div>
                <div className="text-[11px] text-muted-foreground/70">
                  {td.num_stops}정거장 · {step.duration_text}
                </div>
              </div>
            </button>
          );
        }

        if (step.travel_mode === "WALKING") {
          return (
            <button
              key={i}
              type="button"
              onClick={() => hasLocation && onStepClick(i)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 w-full text-left transition-colors",
                hasLocation && "cursor-pointer hover:bg-accent/50",
                isSelected && "bg-primary/5 ring-1 ring-inset ring-primary/30"
              )}
            >
              <Footprints className="w-3 h-3 text-muted-foreground/60 shrink-0" />
              <span className="text-[11px] text-muted-foreground">
                도보 {step.duration_text} · {step.distance_text}
              </span>
            </button>
          );
        }

        // DRIVING or other
        return (
          <button
            key={i}
            type="button"
            onClick={() => hasLocation && onStepClick(i)}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 w-full text-left transition-colors",
              hasLocation && "cursor-pointer hover:bg-accent/50",
              isSelected && "bg-primary/5 ring-1 ring-inset ring-primary/30"
            )}
          >
            <Car className="w-3 h-3 text-muted-foreground/60 shrink-0" />
            <span className="text-[11px] text-muted-foreground">
              {step.instruction} · {step.duration_text}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// -----------------------------------------------------------------------
// Inline Mini Map (출발/도착 마커 + 실제 경로 + 단계 선택 연동)
// -----------------------------------------------------------------------
interface MiniMapProps {
  originLat: number;
  originLng: number;
  destLat: number;
  destLng: number;
  originLabel: string;
  destLabel: string;
  routePolyline?: string;
  steps?: RouteStep[];
  selectedStepIndex: number | null;
}

function MiniMap({
  originLat,
  originLng,
  destLat,
  destLng,
  originLabel,
  destLabel,
  routePolyline,
  steps,
  selectedStepIndex,
}: MiniMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const overviewPolylineRef = useRef<google.maps.Polyline | null>(null);
  const highlightPolylineRef = useRef<google.maps.Polyline | null>(null);
  const stepMarkerRef = useRef<google.maps.Marker | null>(null);
  const routeBoundsRef = useRef<google.maps.LatLngBounds | null>(null);
  const [loaded, setLoaded] = useState(false);

  // 지도 초기화
  useEffect(() => {
    if (!hasApiKey()) return;

    let cancelled = false;
    setLoaded(false);
    overviewPolylineRef.current = null;
    highlightPolylineRef.current = null;
    stepMarkerRef.current = null;
    routeBoundsRef.current = null;

    async function init() {
      try {
        await loadGoogleMaps();
        if (cancelled || !mapRef.current) return;

        const origin = { lat: originLat, lng: originLng };
        const dest = { lat: destLat, lng: destLng };
        const bounds = new google.maps.LatLngBounds();
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

        mapInstanceRef.current = map;

        // 출발 마커
        new google.maps.Marker({
          position: origin,
          map,
          title: originLabel,
          label: {
            text: "A",
            color: "#fff",
            fontWeight: "bold",
            fontSize: "11px",
          },
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
          label: {
            text: "B",
            color: "#fff",
            fontWeight: "bold",
            fontSize: "11px",
          },
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 12,
            fillColor: "#ef4444",
            fillOpacity: 1,
            strokeColor: "#dc2626",
            strokeWeight: 2,
          },
        });

        // 경로 표시
        if (routePolyline) {
          const path = decodePolyline(routePolyline);
          path.forEach((p) => bounds.extend(p));

          overviewPolylineRef.current = new google.maps.Polyline({
            path,
            geodesic: true,
            strokeColor: "#4285f4",
            strokeOpacity: 0.85,
            strokeWeight: 4,
            map,
          });
        } else {
          // 폴리라인 없으면 점선 직선
          new google.maps.Polyline({
            path: [origin, dest],
            geodesic: true,
            strokeColor: "#6b7280",
            strokeOpacity: 0,
            icons: [
              {
                icon: {
                  path: "M 0,-1 0,1",
                  strokeOpacity: 0.4,
                  scale: 3,
                },
                offset: "0",
                repeat: "12px",
              },
            ],
            map,
          });
        }

        routeBoundsRef.current = bounds;
        map.fitBounds(bounds, 40);
        setLoaded(true);
      } catch (e) {
        console.error("[MiniMap]", e);
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [
    originLat,
    originLng,
    destLat,
    destLng,
    originLabel,
    destLabel,
    routePolyline,
  ]);

  // 단계 선택 시 지도 연동
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !loaded) return;

    // 기존 하이라이트 정리
    if (highlightPolylineRef.current) {
      highlightPolylineRef.current.setMap(null);
      highlightPolylineRef.current = null;
    }
    if (stepMarkerRef.current) {
      stepMarkerRef.current.setMap(null);
      stepMarkerRef.current = null;
    }

    if (selectedStepIndex !== null && steps?.[selectedStepIndex]) {
      const step = steps[selectedStepIndex];
      const lineColor = step.transit_details?.line_color || "#4285f4";

      // 전체 경로 희미하게
      overviewPolylineRef.current?.setOptions({ strokeOpacity: 0.2 });

      // 선택된 단계 폴리라인 강조
      if (step.polyline) {
        const path = decodePolyline(step.polyline);
        const stepBounds = new google.maps.LatLngBounds();
        path.forEach((p) => stepBounds.extend(p));

        highlightPolylineRef.current = new google.maps.Polyline({
          path,
          geodesic: true,
          strokeColor: lineColor,
          strokeOpacity: 1,
          strokeWeight: 6,
          map,
        });

        map.fitBounds(stepBounds, 50);
      } else if (step.start_location) {
        map.panTo(step.start_location);
        map.setZoom(15);
      }

      // 시작 지점 마커
      if (step.start_location) {
        stepMarkerRef.current = new google.maps.Marker({
          position: step.start_location,
          map,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: lineColor,
            fillOpacity: 1,
            strokeColor: "#fff",
            strokeWeight: 2,
          },
        });
      }
    } else {
      // 선택 해제 → 전체 경로 복원
      overviewPolylineRef.current?.setOptions({ strokeOpacity: 0.85 });
      if (routeBoundsRef.current) {
        map.fitBounds(routeBoundsRef.current, 40);
      }
    }
  }, [selectedStepIndex, steps, loaded]);

  if (!hasApiKey()) {
    return (
      <div className="h-40 md:h-full rounded-lg bg-muted/50 flex items-center justify-center text-xs text-muted-foreground">
        지도 API 키가 필요합니다
      </div>
    );
  }

  return (
    <div className="relative h-40 md:h-full rounded-lg overflow-hidden border">
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
  } | null>(null);

  // 상세 경로 정보 (steps + polyline)
  const [routeDetails, setRouteDetails] = useState<RouteDetails | null>(null);
  const [fetchingDetails, setFetchingDetails] = useState(false);

  // 선택된 경로 단계 인덱스
  const [selectedStepIndex, setSelectedStepIndex] = useState<number | null>(
    null
  );

  const duration = nextItem.travel_duration_seconds;
  const distance = nextItem.travel_distance_meters;
  const mode = nextItem.travel_mode;

  const hasCoords =
    currentItem.place?.latitude != null &&
    currentItem.place?.longitude != null &&
    nextItem.place?.latitude != null &&
    nextItem.place?.longitude != null;

  const hasCachedInfo = duration != null && distance != null;

  /** 경로 단계 클릭 토글 */
  const handleStepClick = useCallback((index: number) => {
    setSelectedStepIndex((prev) => (prev === index ? null : index));
  }, []);

  /** 캐시된 아이템 확장 시 상세 경로 정보 조회 */
  async function fetchRouteDetails() {
    if (!hasCoords || fetchingDetails || routeDetails) return;
    setFetchingDetails(true);
    try {
      const res = await fetch(
        `/api/directions?origin=${currentItem.place!.latitude},${currentItem.place!.longitude}&destination=${nextItem.place!.latitude},${nextItem.place!.longitude}&mode=${mode || "transit"}`
      );
      if (res.ok) {
        const data = await res.json();
        setRouteDetails({
          steps: data.steps,
          overview_polyline: data.overview_polyline,
        });
      }
    } catch (e) {
      console.error("[TravelInfoCard] detail fetch error:", e);
    } finally {
      setFetchingDetails(false);
    }
  }

  /** 미계산 상태에서 길찾기 클릭 시 API 호출 */
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
        });
        setRouteDetails({
          steps: data.steps,
          overview_polyline: data.overview_polyline,
        });
        setExpanded(true);
      }
    } catch (e) {
      console.error("[TravelInfoCard] fetch error:", e);
    } finally {
      setFetching(false);
    }
  }

  /** 캐시된 아이템의 확장 토글 */
  function handleCachedExpand() {
    const willExpand = !expanded;
    setExpanded(willExpand);
    if (willExpand && !routeDetails) {
      fetchRouteDetails();
    }
    if (!willExpand) {
      setSelectedStepIndex(null);
    }
  }

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

  // 이동 정보 없음 + 좌표 없음 -> 단순 구분선
  if (!hasCachedInfo && !hasCoords) {
    return (
      <div className="flex items-center gap-2 py-1 pl-4">
        <div className="flex-1 border-t border-dashed border-muted-foreground/20" />
        <ArrowDown className="w-3 h-3 text-muted-foreground/40" />
        <div className="flex-1 border-t border-dashed border-muted-foreground/20" />
      </div>
    );
  }

  // 확장 영역 공통 렌더링
  function renderExpandedContent(
    displayMode: TravelMode | null,
    displayDuration: number,
    displayDistance: number
  ) {
    return (
      <div className="mx-4 mb-2 space-y-2 animate-in slide-in-from-top-1 duration-200">
        {/* 경로 단계 + 지도 (데스크톱: 수평 배치) */}
        <div className="flex flex-col md:flex-row gap-2">
          {/* 왼쪽: 경로 단계 */}
          <div className="flex-1 min-w-0">
            {fetchingDetails && !routeDetails ? (
              <div className="flex items-center justify-center py-3">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                <span className="text-xs text-muted-foreground ml-1.5">
                  경로 상세 조회 중...
                </span>
              </div>
            ) : routeDetails?.steps && routeDetails.steps.length > 0 ? (
              <StepList
                steps={routeDetails.steps}
                selectedIndex={selectedStepIndex}
                onStepClick={handleStepClick}
              />
            ) : (
              <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-primary/5 border border-primary/10 h-full">
                {getModeIcon(displayMode, "w-4 h-4 text-primary shrink-0")}
                <div className="flex flex-col gap-0.5">
                  <span className="text-[11px] font-semibold text-foreground">
                    추천 경로
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {getModeLabel(displayMode)} {formatDuration(displayDuration)}{" "}
                    &middot; {formatDistance(displayDistance)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* 오른쪽: 미니맵 */}
          {hasCoords && (
            <div className="md:w-1/2 shrink-0 md:min-h-40">
              <MiniMap
                originLat={currentItem.place!.latitude!}
                originLng={currentItem.place!.longitude!}
                destLat={nextItem.place!.latitude!}
                destLng={nextItem.place!.longitude!}
                originLabel={currentItem.title}
                destLabel={nextItem.title}
                routePolyline={routeDetails?.overview_polyline}
                steps={routeDetails?.steps}
                selectedStepIndex={selectedStepIndex}
              />
            </div>
          )}
        </div>

        {/* Google Maps 연결 */}
        {hasCoords && (
          <a
            href={buildGoogleMapsUrl(
              { name: currentItem.title, lat: currentItem.place!.latitude!, lng: currentItem.place!.longitude!, placeId: currentItem.place!.google_place_id },
              { name: nextItem.title, lat: nextItem.place!.latitude!, lng: nextItem.place!.longitude!, placeId: nextItem.place!.google_place_id },
              displayMode
            )}
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

  // 캐싱된 이동 정보가 있을 때 -> 탭 가능 pill + accordion
  if (hasCachedInfo) {
    return (
      <div className="space-y-0">
        {/* Pill */}
        <div className="flex items-center gap-2 py-1.5 pl-4">
          <div className="flex-1 border-t border-dashed border-muted-foreground/20" />
          <button
            type="button"
            onClick={handleCachedExpand}
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
        {expanded && renderExpandedContent(mode, duration, distance)}
      </div>
    );
  }

  // 좌표 있지만 미계산 -> 길찾기 클릭 시 경로 조회 후 표시
  return (
    <div className="space-y-0">
      <div className="flex items-center gap-2 py-1.5 pl-4">
        <div className="flex-1 border-t border-dashed border-muted-foreground/20" />
        {hasCoords ? (
          <button
            type="button"
            onClick={
              fetchedInfo
                ? () => {
                    const willExpand = !expanded;
                    setExpanded(willExpand);
                    if (!willExpand) setSelectedStepIndex(null);
                  }
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

      {/* 조회된 경로 정보 확장 영역 */}
      {fetchedInfo &&
        expanded &&
        hasCoords &&
        renderExpandedContent(
          fetchedInfo.mode,
          fetchedInfo.duration,
          fetchedInfo.distance
        )}
    </div>
  );
});
