"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { hasApiKey } from "@/lib/maps/google-maps";

export interface PlaceSearchResult {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  rating: number | null;
  userRatingsTotal: number | null;
  url: string | null;
  website: string | null;
  phoneNumber: string | null;
  imageUrls: string[];
  openingHours: Record<string, string> | null;
  placeTypes: string[];
}

interface PlaceSearchProps {
  onSelect: (result: PlaceSearchResult) => void;
}

interface Suggestion {
  placeId: string;
  mainText: string;
  secondaryText: string;
}

export function PlaceSearch({ onSelect }: PlaceSearchProps) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [apiReady, setApiReady] = useState(false);
  const serviceRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Google Places Service 초기화
  useEffect(() => {
    if (!hasApiKey()) return;

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
        serviceRef.current = new google.maps.places.AutocompleteService();
        setApiReady(true);
      } catch (err) {
        console.error("Google Places init failed:", err);
      }
    }

    init();
  }, []);

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // 검색어 변경 시 자동완성 요청 (debounce)
  const handleInputChange = useCallback(
    (value: string) => {
      setQuery(value);

      if (debounceRef.current) clearTimeout(debounceRef.current);

      if (!value.trim() || !serviceRef.current) {
        setSuggestions([]);
        setShowDropdown(false);
        return;
      }

      debounceRef.current = setTimeout(() => {
        setLoading(true);
        serviceRef.current!.getPlacePredictions(
          { input: value, types: ["establishment"] },
          (predictions, status) => {
            setLoading(false);
            if (
              status === google.maps.places.PlacesServiceStatus.OK &&
              predictions
            ) {
              setSuggestions(
                predictions.map((p) => ({
                  placeId: p.place_id,
                  mainText: p.structured_formatting.main_text,
                  secondaryText: p.structured_formatting.secondary_text || "",
                }))
              );
              setShowDropdown(true);
            } else {
              setSuggestions([]);
              setShowDropdown(false);
            }
          }
        );
      }, 300);
    },
    []
  );

  // 장소 선택 시 상세 정보 조회
  async function handleSelect(suggestion: Suggestion) {
    setShowDropdown(false);
    setQuery(suggestion.mainText);

    try {
      // 상세 정보를 가져오기 위해 임시 div 사용
      const div = document.createElement("div");
      const placesService = new google.maps.places.PlacesService(div);

      placesService.getDetails(
        {
          placeId: suggestion.placeId,
          fields: [
            "name",
            "formatted_address",
            "geometry",
            "rating",
            "user_ratings_total",
            "url",
            "website",
            "formatted_phone_number",
            "international_phone_number",
            "photos",
            "types",
            "opening_hours",
          ],
        },
        (place, status) => {
          if (
            status !== google.maps.places.PlacesServiceStatus.OK ||
            !place?.geometry?.location
          ) {
            return;
          }

          // 사진 최대 3장
          const imageUrls: string[] = [];
          if (place.photos) {
            const max = Math.min(place.photos.length, 3);
            for (let i = 0; i < max; i++) {
              imageUrls.push(place.photos[i].getUrl({ maxWidth: 800 }));
            }
          }

          // 영업시간 파싱
          let openingHours: Record<string, string> | null = null;
          if (place.opening_hours?.weekday_text) {
            openingHours = {};
            for (const line of place.opening_hours.weekday_text) {
              const parts = line.split(": ");
              if (parts.length === 2) {
                openingHours[parts[0]] = parts[1];
              }
            }
          }

          const result: PlaceSearchResult = {
            name: place.name ?? "",
            address: place.formatted_address ?? "",
            latitude: place.geometry.location.lat(),
            longitude: place.geometry.location.lng(),
            rating: place.rating ?? null,
            userRatingsTotal: place.user_ratings_total ?? null,
            url: place.url ?? null,
            website: place.website ?? null,
            phoneNumber: place.international_phone_number ?? place.formatted_phone_number ?? null,
            imageUrls,
            openingHours,
            placeTypes: place.types ?? [],
          };

          onSelect(result);
        }
      );
    } catch (err) {
      console.error("Place details fetch failed:", err);
    }
  }

  if (!hasApiKey()) return null;

  return (
    <div ref={wrapperRef} className="relative">
      <Input
        placeholder={apiReady ? "장소 검색 (호텔, 관광지, 맛집...)" : "지도 검색 로딩 중..."}
        value={query}
        onChange={(e) => handleInputChange(e.target.value)}
        onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
        disabled={!apiReady}
        autoComplete="off"
      />

      {showDropdown && suggestions.length > 0 && (
        <ul className="absolute left-0 right-0 top-full z-[9999] mt-1 max-h-60 overflow-auto rounded-md border bg-white shadow-lg">
          {suggestions.map((s) => (
            <li
              key={s.placeId}
              className="cursor-pointer px-3 py-2.5 hover:bg-gray-100 border-b last:border-b-0"
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect(s);
              }}
            >
              <div className="font-medium text-sm">{s.mainText}</div>
              <div className="text-xs text-muted-foreground truncate">
                {s.secondaryText}
              </div>
            </li>
          ))}
        </ul>
      )}

      {loading && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      )}
    </div>
  );
}
