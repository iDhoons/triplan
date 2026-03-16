import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { TripMember } from "@/types/database";

export function useTripMembers(tripId: string) {
  return useQuery({
    queryKey: ["members", tripId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("trip_members")
        .select(
          "*, profile:profiles(id, display_name, avatar_url)"
        )
        .eq("trip_id", tripId);
      if (error) throw error;
      return (data as TripMember[]) ?? [];
    },
    enabled: !!tripId,
  });
}
