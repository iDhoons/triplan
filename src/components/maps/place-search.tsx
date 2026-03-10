"use client";

import { useEffect, useRef, useState } from "react";
import { hasApiKey } from "@/lib/maps/google-maps";

export interface PlaceSearchResult {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  rating: number | null;
  url: string | null;
  imageUrl: string | null;
  placeTypes: string[];
}

interface PlaceSearchProps {
  onSelect: (result: PlaceSearchResult) => void;
}

export function PlaceSearch({ onSelect }: PlaceSearchProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  );
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const initedRef = useRef(false);

  useEffect(() => {
    if (!hasApiKey() || !containerRef.current || initedRef.current) return;
    initedRef.current = true;

    const container = containerRef.current;

    async function init() {
      try {
        const { setOptions, importLibrary } = await import(
          "@googlemaps/js-api-loader"
        );
        setOptions({
          key: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "",
          v: "weekly",
          libraries: ["places"],
        });

        await importLibrary("places");

        // PlaceAutocompleteElement 생성
        const autocomplete = new (
          google.maps.places as any
        ).PlaceAutocompleteElement();

        autocomplete.style.width = "100%";
        container.appendChild(autocomplete);

        autocomplete.addEventListener("gmp-select", async (event: any) => {
          const placePrediction = event.placePrediction;
          if (!placePrediction) return;

          try {
            const place = placePrediction.toPlace();
            await place.fetchFields({
              fields: [
                "displayName",
                "formattedAddress",
                "location",
                "rating",
                "googleMapsURI",
                "photos",
                "types",
              ],
            });

            const loc = place.location;
            if (!loc) return;

            let imageUrl: string | null = null;
            if (place.photos && place.photos.length > 0) {
              imageUrl = place.photos[0].getURI({ maxWidth: 800 });
            }

            const result: PlaceSearchResult = {
              name: place.displayName ?? "",
              address: place.formattedAddress ?? "",
              latitude: loc.lat(),
              longitude: loc.lng(),
              rating: place.rating ?? null,
              url: place.googleMapsURI ?? null,
              imageUrl,
              placeTypes: place.types ?? [],
            };

            onSelectRef.current(result);
          } catch (err) {
            console.error("Place details fetch failed:", err);
          }
        });

        setStatus("ready");
      } catch (err) {
        console.error("Google Places init failed:", err);
        setStatus("error");
      }
    }

    init();

    // cleanup: React가 container의 자식을 건드리지 않도록 수동 정리
    return () => {
      while (container.firstChild) {
        container.removeChild(container.firstChild);
      }
      initedRef.current = false;
    };
  }, []);

  if (!hasApiKey()) {
    return null;
  }

  return (
    <div>
      {status === "error" && (
        <p className="text-xs text-red-500">
          Google Places API 로드 실패. Cloud Console에서 Places API (New)를
          확인하세요.
        </p>
      )}
      {status === "loading" && (
        <div className="h-9 rounded-md border bg-muted animate-pulse flex items-center px-3">
          <span className="text-sm text-muted-foreground">
            지도 검색 로딩 중...
          </span>
        </div>
      )}
      {/*
        React가 이 div의 자식을 관리하지 않음 - Google Web Component가 직접 삽입됨.
        suppressHydrationWarning으로 React의 DOM 불일치 경고 방지.
      */}
      <div ref={containerRef} suppressHydrationWarning />
    </div>
  );
}
