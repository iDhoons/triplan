"use client";

import { useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Schedule, Place, Trip } from "@/types/database";

/**
 * Schedule 페이지의 데이터 페칭 훅 (React Query 기반).
 * - RealtimeProvider의 ["schedules", tripId] invalidation과 자동 연결
 * - 날씨 동기화는 초기 로드 후 논블로킹으로 실행
 */
export function useScheduleData(tripId: string) {
  const supabase = createClient();
  const queryClient = useQueryClient();

  // --- Trip ---
  const tripQuery = useQuery({
    queryKey: ["trip", tripId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trips")
        .select("*")
        .eq("id", tripId)
        .single();
      if (error) throw error;
      return data as Trip;
    },
    enabled: !!tripId,
  });

  // --- Schedules (with items + places) ---
  const schedulesQuery = useQuery({
    queryKey: ["schedules", tripId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedules")
        .select(`*, items:schedule_items(*, place:places(*))`)
        .eq("trip_id", tripId)
        .order("date", { ascending: true });
      if (error) throw error;
      return ((data as Schedule[]) ?? []).map((s) => ({
        ...s,
        items: (s.items ?? [])
          .slice()
          .sort((a, b) => a.sort_order - b.sort_order),
      }));
    },
    enabled: !!tripId,
  });

  // --- Places (for sidebar) ---
  const placesQuery = useQuery({
    queryKey: ["places", tripId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("places")
        .select("*")
        .eq("trip_id", tripId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data as Place[]) ?? [];
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
        queryClient.invalidateQueries({ queryKey: ["schedules", tripId] });
      }
    } catch {
      // 날씨 실패는 무시
    }
  }, [tripId, queryClient]);

  useEffect(() => {
    if (schedulesQuery.data && !schedulesQuery.isStale) {
      syncWeather();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schedulesQuery.data != null]);

  const loading = tripQuery.isLoading || schedulesQuery.isLoading || placesQuery.isLoading;
  const error = tripQuery.error || schedulesQuery.error || placesQuery.error;

  return {
    trip: tripQuery.data ?? null,
    schedules: schedulesQuery.data ?? [],
    places: placesQuery.data ?? [],
    loading,
    error,
    supabase,
    refetch: async () => {
      await queryClient.invalidateQueries({ queryKey: ["schedules", tripId] });
      await queryClient.invalidateQueries({ queryKey: ["places", tripId] });
    },
  };
}
