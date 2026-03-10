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
  placeholder?: string;
}

export function PlaceSearch({
  onSelect,
  placeholder = "장소 검색 (호텔, 관광지, 맛집...)",
}: PlaceSearchProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    if (!hasApiKey() || !containerRef.current) return;

    let mounted = true;

    async function init() {
      try {
        const { importLibrary } = await import("@googlemaps/js-api-loader");
        const { setOptions } = await import("@googlemaps/js-api-loader");
        setOptions({
          key: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "",
          v: "weekly",
          libraries: ["places"],
        });

        await importLibrary("places");

        if (!mounted || !containerRef.current) return;

        // 기존 자식 노드 제거 (안전한 DOM 조작)
        while (containerRef.current.firstChild) {
          containerRef.current.removeChild(containerRef.current.firstChild);
        }

        // 새 PlaceAutocompleteElement API 사용
        const autocomplete = new (google.maps.places as any).PlaceAutocompleteElement({
          inputPlaceholder: placeholder,
        });

        autocomplete.style.width = "100%";
        autocomplete.style.height = "36px";
        autocomplete.style.borderRadius = "6px";
        autocomplete.style.fontSize = "14px";

        containerRef.current.appendChild(autocomplete);

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

        if (mounted) setLoaded(true);
      } catch (err) {
        console.error("Google Places init failed:", err);
        if (mounted)
          setError(
            "Google Places API를 로드할 수 없습니다. Google Cloud Console에서 Places API (New)를 활성화하세요."
          );
      }
    }

    init();

    return () => {
      mounted = false;
    };
  }, [placeholder]);

  if (!hasApiKey()) {
    return null;
  }

  if (error) {
    return <p className="text-xs text-red-500">{error}</p>;
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        <span className="text-lg">🔍</span>
        <div ref={containerRef} className="flex-1">
          {!loaded && (
            <div className="h-9 rounded-md border bg-muted animate-pulse flex items-center px-3">
              <span className="text-sm text-muted-foreground">
                지도 검색 로딩 중...
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
