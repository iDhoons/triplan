"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { hasApiKey } from "@/lib/maps/google-maps";
import { setOptions, importLibrary } from "@googlemaps/js-api-loader";

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
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!hasApiKey() || loaded) return;

    let mounted = true;

    async function init() {
      try {
        setOptions({
          key: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "",
          v: "weekly",
          libraries: ["maps", "marker", "places"],
        });

        await importLibrary("places");

        if (!mounted || !inputRef.current) return;

        const autocomplete = new google.maps.places.Autocomplete(
          inputRef.current,
          {
            fields: [
              "name",
              "formatted_address",
              "geometry",
              "rating",
              "url",
              "photos",
              "types",
            ],
          }
        );

        autocomplete.addListener("place_changed", () => {
          const place = autocomplete.getPlace();
          if (!place.geometry?.location) return;

          const result: PlaceSearchResult = {
            name: place.name ?? "",
            address: place.formatted_address ?? "",
            latitude: place.geometry.location.lat(),
            longitude: place.geometry.location.lng(),
            rating: place.rating ?? null,
            url: place.url ?? null,
            imageUrl:
              place.photos && place.photos.length > 0
                ? place.photos[0].getUrl({ maxWidth: 800 })
                : null,
            placeTypes: place.types ?? [],
          };

          onSelect(result);
        });

        autocompleteRef.current = autocomplete;
        setLoaded(true);
      } catch {
        // API 키 에러 등은 무시
      }
    }

    init();

    return () => {
      mounted = false;
    };
  }, [onSelect, loaded]);

  if (!hasApiKey()) {
    return null;
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        <span className="text-lg">🔍</span>
        <Input
          ref={inputRef}
          placeholder={placeholder}
          className="flex-1"
          autoComplete="off"
        />
      </div>
      {!loaded && (
        <p className="text-xs text-muted-foreground mt-1">
          지도 검색 로딩 중...
        </p>
      )}
    </div>
  );
}
