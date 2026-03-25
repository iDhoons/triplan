import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Trip } from "@/types/database";
import { queryKeys } from "./query-keys";

// Backward compatibility: dashboard/page.tsx 등에서 직접 사용
export { tripsQueryKey } from "./query-keys";

export function useTrips() {
  return useQuery<Trip[]>({
    queryKey: queryKeys.trips.all,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("trips")
        .select("id, title, destination, start_date, end_date, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as Trip[]) ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });
}
