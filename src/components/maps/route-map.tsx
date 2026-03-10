"use client";

import { useEffect, useRef, useState } from "react";
import { MapPinIcon, RouteIcon } from "lucide-react";
import { loadGoogleMaps, hasApiKey } from "@/lib/maps/google-maps";
import type { ScheduleItem } from "@/types/database";

interface RouteMapProps {
  scheduleItems: ScheduleItem[];
  className?: string;
}

// Haversine formula — 두 좌표 간 직선거리 (km)
function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calcTotalDistance(
  items: Array<{ lat: number; lng: number }>
): number {
  let total = 0;
  for (let i = 0; i < items.length - 1; i++) {
    total += haversineKm(
      items[i].lat,
      items[i].lng,
      items[i + 1].lat,
      items[i + 1].lng
    );
  }
  return total;
}

export function RouteMap({ scheduleItems, className }: RouteMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const polylineRef = useRef<google.maps.Polyline | null>(null);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalDistance, setTotalDistance] = useState<number>(0);

  if (!hasApiKey()) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-3 rounded-xl border bg-muted/30 text-muted-foreground ${className ?? "h-96"}`}
      >
        <MapPinIcon className="size-10 opacity-30" />
        <p className="text-sm">지도 API 키를 설정해주세요</p>
        <p className="text-xs opacity-60">
          NEXT_PUBLIC_GOOGLE_MAPS_API_KEY 환경 변수를 확인하세요
        </p>
      </div>
    );
  }

  // place가 있고 좌표가 있는 아이템만 추출
  const validItems = scheduleItems.filter(
    (item) =>
      item.place &&
      item.place.latitude !== null &&
      item.place.longitude !== null
  );

  return (
    <RouteMapInner
      scheduleItems={scheduleItems}
      validItems={validItems}
      className={className}
      loaded={loaded}
      setLoaded={setLoaded}
      error={error}
      setError={setError}
      totalDistance={totalDistance}
      setTotalDistance={setTotalDistance}
      mapRef={mapRef}
      mapInstanceRef={mapInstanceRef}
      markersRef={markersRef}
      polylineRef={polylineRef}
      infoWindowRef={infoWindowRef}
    />
  );
}

interface ValidItem {
  lat: number;
  lng: number;
}

interface InnerProps {
  scheduleItems: ScheduleItem[];
  validItems: ScheduleItem[];
  className?: string;
  loaded: boolean;
  setLoaded: (v: boolean) => void;
  error: string | null;
  setError: (v: string | null) => void;
  totalDistance: number;
  setTotalDistance: (v: number) => void;
  mapRef: React.RefObject<HTMLDivElement | null>;
  mapInstanceRef: React.MutableRefObject<google.maps.Map | null>;
  markersRef: React.MutableRefObject<google.maps.Marker[]>;
  polylineRef: React.MutableRefObject<google.maps.Polyline | null>;
  infoWindowRef: React.MutableRefObject<google.maps.InfoWindow | null>;
}

function RouteMapInner({
  validItems,
  className,
  loaded,
  setLoaded,
  error,
  setError,
  totalDistance,
  setTotalDistance,
  mapRef,
  mapInstanceRef,
  markersRef,
  polylineRef,
  infoWindowRef,
}: InnerProps) {
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        await loadGoogleMaps();
        if (cancelled || !mapRef.current) return;

        if (!mapInstanceRef.current) {
          mapInstanceRef.current = new google.maps.Map(mapRef.current, {
            zoom: 12,
            center: { lat: 37.5665, lng: 126.978 },
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
          });
          infoWindowRef.current = new google.maps.InfoWindow();
        }

        setLoaded(true);
      } catch (e) {
        if (!cancelled) {
          console.error(e);
          setError("지도를 불러오는데 실패했습니다.");
        }
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, []);

  // validItems 변경 시 마커/폴리라인 갱신
  useEffect(() => {
    if (!loaded || !mapInstanceRef.current) return;

    // 기존 마커 제거
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    // 기존 폴리라인 제거
    if (polylineRef.current) {
      polylineRef.current.setMap(null);
      polylineRef.current = null;
    }

    if (validItems.length === 0) {
      setTotalDistance(0);
      return;
    }

    const bounds = new google.maps.LatLngBounds();
    const path: google.maps.LatLngLiteral[] = [];

    validItems.forEach((item, index) => {
      const lat = item.place!.latitude as number;
      const lng = item.place!.longitude as number;
      const position = { lat, lng };
      path.push(position);
      bounds.extend(position);

      // 번호 표시 마커 (SVG 레이블)
      const marker = new google.maps.Marker({
        position,
        map: mapInstanceRef.current!,
        title: item.title,
        label: {
          text: String(index + 1),
          color: "#ffffff",
          fontWeight: "bold",
          fontSize: "12px",
        },
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 14,
          fillColor: "#3b82f6",
          fillOpacity: 1,
          strokeColor: "#1d4ed8",
          strokeWeight: 2,
        },
      });

      marker.addListener("click", () => {
        const place = item.place!;
        const timeStr =
          item.start_time
            ? `<p style="margin:2px 0 0;font-size:11px;color:#666;">${item.start_time}${item.end_time ? ` ~ ${item.end_time}` : ""}</p>`
            : "";
        const content = `
          <div style="padding:4px 2px;min-width:130px;">
            <span style="display:inline-block;background:#3b82f6;color:#fff;border-radius:50%;width:20px;height:20px;text-align:center;line-height:20px;font-size:11px;font-weight:bold;margin-right:6px;">${index + 1}</span>
            <strong style="font-size:14px;">${item.title}</strong>
            ${timeStr}
            ${place.address ? `<p style="margin:4px 0 0;font-size:11px;color:#999;">${place.address}</p>` : ""}
          </div>
        `;
        infoWindowRef.current?.setContent(content);
        infoWindowRef.current?.open(mapInstanceRef.current, marker);
      });

      markersRef.current.push(marker);
    });

    // 폴리라인
    if (path.length > 1) {
      polylineRef.current = new google.maps.Polyline({
        path,
        geodesic: true,
        strokeColor: "#3b82f6",
        strokeOpacity: 0.8,
        strokeWeight: 3,
        map: mapInstanceRef.current!,
      });
    }

    // 총 거리 계산
    const coordList = validItems.map((item) => ({
      lat: item.place!.latitude as number,
      lng: item.place!.longitude as number,
    }));
    setTotalDistance(calcTotalDistance(coordList));

    if (validItems.length === 1) {
      mapInstanceRef.current!.setCenter(bounds.getCenter());
      mapInstanceRef.current!.setZoom(14);
    } else {
      mapInstanceRef.current!.fitBounds(bounds, 60);
    }
  }, [loaded, validItems]);

  if (error) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-2 rounded-xl border bg-muted/30 text-muted-foreground ${className ?? "h-96"}`}
      >
        <MapPinIcon className="size-8 opacity-30" />
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden rounded-xl border ${className ?? "h-96"}`}>
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/50 z-10">
          <div className="text-sm text-muted-foreground animate-pulse">
            지도 불러오는 중...
          </div>
        </div>
      )}
      <div ref={mapRef} className="h-full w-full" />

      {/* 총 이동거리 오버레이 */}
      {loaded && totalDistance > 0 && (
        <div className="absolute bottom-3 left-3 z-10 flex items-center gap-1.5 rounded-lg bg-white/90 dark:bg-zinc-900/90 px-3 py-1.5 shadow text-xs font-medium border">
          <RouteIcon className="size-3.5 text-blue-500" />
          <span>총 이동거리 약 {totalDistance.toFixed(1)} km</span>
        </div>
      )}

      {loaded && validItems.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/5 pointer-events-none">
          <MapPinIcon className="size-8 opacity-30" />
          <p className="text-sm text-muted-foreground">
            좌표 정보가 있는 일정이 없습니다
          </p>
        </div>
      )}
    </div>
  );
}
