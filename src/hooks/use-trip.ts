"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Trip } from "@/types/database";
import { queryKeys } from "./query-keys";

/**
 * Trip 데이터를 React Query로 캐싱하는 공유 훅.
 * trip-layout-client, members, schedule 등 여러 곳에서 같은 캐시를 공유한다.
 */
export function useTrip(tripId: string) {
  return useQuery<Trip>({
    queryKey: queryKeys.trips.byId(tripId),
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("trips")
        .select("id, title, destination, start_date, end_date, cover_image_url, invite_code, created_by, created_at, updated_at")
        .eq("id", tripId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!tripId,
  });
}

/** Trip 캐시를 즉시 업데이트하고 무효화하는 유틸리티 */
export function useInvalidateTrip() {
  const queryClient = useQueryClient();
  return {
    invalidate: (tripId: string) =>
      queryClient.invalidateQueries({ queryKey: queryKeys.trips.byId(tripId) }),
    setData: (tripId: string, trip: Trip) =>
      queryClient.setQueryData(queryKeys.trips.byId(tripId), trip),
  };
}
