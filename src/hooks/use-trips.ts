import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Trip } from "@/types/database";

export const tripsQueryKey = ["trips"] as const;

export function useTrips() {
  return useQuery({
    queryKey: tripsQueryKey,
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
