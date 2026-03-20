"use client";

import { useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Schedule, Place, Trip } from "@/types/database";

/**
 * Schedule 페이지의 데이터 페칭 훅 (React Query 기반).
 * - Trip, Schedules, Places를 Promise.all로 병렬 fetch
 * - RealtimeProvider의 ["schedule-data", tripId] invalidation과 자동 연결
 * - 날씨 동기화는 초기 로드 후 논블로킹으로 실행
 */
export function useScheduleData(tripId: string) {
  const supabase = createClient();
  const queryClient = useQueryClient();

  // --- Trip + Schedules + Places (병렬 fetch) ---
  const combinedQuery = useQuery({
    queryKey: ["schedule-data", tripId],
    queryFn: async () => {
      const [tripResult, schedulesResult, placesResult] = await Promise.all([
        supabase.from("trips").select("id, title, destination, start_date, end_date, style, cover_image_url, invite_code, created_by, created_at, updated_at").eq("id", tripId).single(),
        supabase
          .from("schedules")
          .select(`*, items:schedule_items(*, place:places(*))`)
          .eq("trip_id", tripId)
          .order("date", { ascending: true }),
        supabase
          .from("places")
          .select("id, trip_id, category, name, address, latitude, longitude, rating, image_urls, url, memo, added_by, created_at, google_place_id")
          .eq("trip_id", tripId)
          .order("created_at", { ascending: true }),
      ]);

      if (tripResult.error) throw tripResult.error;
      if (schedulesResult.error) throw schedulesResult.error;
      if (placesResult.error) throw placesResult.error;

      const schedules = ((schedulesResult.data as Schedule[]) ?? []).map(
        (s) => ({
          ...s,
          items: (s.items ?? [])
            .slice()
            .sort((a, b) => a.sort_order - b.sort_order),
        })
      );

      const tripData = tripResult.data as Trip;
      // trip 캐시를 useTrip과 공유
      queryClient.setQueryData(["trip", tripId], tripData);

      return {
        trip: tripData,
        schedules,
        places: (placesResult.data as Place[]) ?? [],
      };
    },
    enabled: !!tripId,
  });

  // --- Weather sync (논블로킹, 초기 로드 후 1회) ---
  const syncWeather = useCallback(async () => {
    try {
      const res = await fetch(`/api/weather?tripId=${tripId}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.status === "updated") {
        queryClient.invalidateQueries({ queryKey: ["schedule-data", tripId] });
      }
    } catch {
      // 날씨 실패는 무시
    }
  }, [tripId, queryClient]);

  useEffect(() => {
    if (combinedQuery.data && !combinedQuery.isStale) {
      syncWeather();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [combinedQuery.data != null]);

  return {
    trip: combinedQuery.data?.trip ?? null,
    schedules: combinedQuery.data?.schedules ?? [],
    places: combinedQuery.data?.places ?? [],
    loading: combinedQuery.isLoading,
    error: combinedQuery.error,
    supabase,
    refetch: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["schedule-data", tripId],
      });
    },
  };
}
