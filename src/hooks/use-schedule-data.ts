"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { Schedule, Place, Trip } from "@/types/database";

/**
 * Schedule 페이지의 데이터 페칭 + 날씨 동기화를 담당하는 훅.
 * - trip, schedules, places를 한 번에 로드
 * - 로드 완료 후 날씨 자동 동기화 (논블로킹)
 */
export function useScheduleData(tripId: string) {
  const supabase = createClient();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: tripData } = await supabase
        .from("trips")
        .select("*")
        .eq("id", tripId)
        .single();
      if (tripData) setTrip(tripData as Trip);

      const { data: schedulesData, error: schedulesError } = await supabase
        .from("schedules")
        .select(
          `*, items:schedule_items(*, place:places(*))`
        )
        .eq("trip_id", tripId)
        .order("date", { ascending: true });

      if (schedulesError) throw schedulesError;

      if (schedulesData) {
        const normalized = (schedulesData as Schedule[]).map((s) => ({
          ...s,
          items: (s.items ?? [])
            .slice()
            .sort((a, b) => a.sort_order - b.sort_order),
        }));
        setSchedules(normalized);
      }

      const { data: placesData } = await supabase
        .from("places")
        .select("*")
        .eq("trip_id", tripId)
        .order("created_at", { ascending: true });

      if (placesData) setPlaces(placesData as Place[]);
    } catch (err) {
      console.error(err);
      toast.error("데이터를 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }, [tripId, supabase]);

  const syncWeather = useCallback(async () => {
    try {
      const res = await fetch(`/api/weather?tripId=${tripId}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.status === "updated") {
        await fetchData();
      }
    } catch {
      // 날씨 실패는 무시
    }
  }, [tripId, fetchData]);

  useEffect(() => {
    fetchData().then(() => syncWeather());
  }, [fetchData, syncWeather]);

  return {
    trip,
    schedules,
    setSchedules,
    places,
    loading,
    supabase,
    refetch: fetchData,
  };
}
