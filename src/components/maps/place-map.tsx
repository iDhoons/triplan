"use client";

import { useEffect, useRef, useState } from "react";
import { MapPinIcon } from "lucide-react";
import { loadGoogleMaps, hasApiKey } from "@/lib/maps/google-maps";
import type { Place } from "@/types/database";

interface PlaceMapProps {
  places: Place[];
  className?: string;
}

export function PlaceMap({ places, className }: PlaceMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  // API 키 없으면 fallback
  if (!hasApiKey()) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-3 rounded-xl border bg-muted/30 text-muted-foreground ${className ?? "h-80"}`}
      >
        <MapPinIcon className="size-10 opacity-30" />
        <p className="text-sm">지도 API 키를 설정해주세요</p>
        <p className="text-xs opacity-60">
          NEXT_PUBLIC_GOOGLE_MAPS_API_KEY 환경 변수를 확인하세요
        </p>
      </div>
    );
  }

  return (
    <PlaceMapInner
      places={places}
      className={className}
      loaded={loaded}
      setLoaded={setLoaded}
      error={error}
      setError={setError}
      mapRef={mapRef}
      mapInstanceRef={mapInstanceRef}
      markersRef={markersRef}
      infoWindowRef={infoWindowRef}
    />
  );
}

// API 키가 있을 때 실제 지도를 렌더링하는 내부 컴포넌트
interface InnerProps {
  places: Place[];
  className?: string;
  loaded: boolean;
  setLoaded: (v: boolean) => void;
  error: string | null;
  setError: (v: string | null) => void;
  mapRef: React.RefObject<HTMLDivElement | null>;
  mapInstanceRef: React.MutableRefObject<google.maps.Map | null>;
  markersRef: React.MutableRefObject<google.maps.Marker[]>;
  infoWindowRef: React.MutableRefObject<google.maps.InfoWindow | null>;
}

const CATEGORY_LABEL: Record<string, string> = {
  accommodation: "숙소",
  attraction: "관광지",
  restaurant: "맛집",
  other: "기타",
};

function PlaceMapInner({
  places,
  className,
  loaded,
  setLoaded,
  error,
  setError,
  mapRef,
  mapInstanceRef,
  markersRef,
  infoWindowRef,
}: InnerProps) {
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        await loadGoogleMaps();
        if (cancelled || !mapRef.current) return;

        // 지도 생성 (한 번만)
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

  // places 변경 시 마커 갱신
  useEffect(() => {
    if (!loaded || !mapInstanceRef.current) return;

    // 기존 마커 제거
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    const validPlaces = places.filter(
      (p) => p.latitude !== null && p.longitude !== null
    );

    if (validPlaces.length === 0) return;

    const bounds = new google.maps.LatLngBounds();

    validPlaces.forEach((place) => {
      const position = {
        lat: place.latitude as number,
        lng: place.longitude as number,
      };

      const marker = new google.maps.Marker({
        position,
        map: mapInstanceRef.current!,
        title: place.name,
      });

      marker.addListener("click", () => {
        const content = `
          <div style="padding:4px 2px;min-width:120px;">
            <strong style="font-size:14px;">${place.name}</strong>
            <p style="margin:4px 0 0;font-size:12px;color:#666;">${CATEGORY_LABEL[place.category] ?? place.category}</p>
            ${place.address ? `<p style="margin:2px 0 0;font-size:11px;color:#999;">${place.address}</p>` : ""}
          </div>
        `;
        infoWindowRef.current?.setContent(content);
        infoWindowRef.current?.open(mapInstanceRef.current, marker);
      });

      markersRef.current.push(marker);
      bounds.extend(position);
    });

    if (validPlaces.length === 1) {
      mapInstanceRef.current!.setCenter(bounds.getCenter());
      mapInstanceRef.current!.setZoom(14);
    } else {
      mapInstanceRef.current!.fitBounds(bounds, 60);
    }
  }, [loaded, places]);

  if (error) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-2 rounded-xl border bg-muted/30 text-muted-foreground ${className ?? "h-80"}`}
      >
        <MapPinIcon className="size-8 opacity-30" />
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden rounded-xl ${className ?? "h-80"}`}>
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/50 z-10">
          <div className="text-sm text-muted-foreground animate-pulse">
            지도 불러오는 중...
          </div>
        </div>
      )}
      <div ref={mapRef} className="h-full w-full" />
      {loaded && places.filter((p) => p.latitude && p.longitude).length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/5 pointer-events-none">
          <MapPinIcon className="size-8 opacity-30" />
          <p className="text-sm text-muted-foreground">
            좌표 정보가 있는 장소가 없습니다
          </p>
        </div>
      )}
    </div>
  );
}
