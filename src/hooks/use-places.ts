import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Place } from "@/types/database";

export function usePlaces(tripId: string) {
  return useQuery({
    queryKey: ["places", tripId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("places")
        .select("id, trip_id, category, name, url, image_urls, latitude, longitude, address, rating, memo, price_per_night, cancel_policy, amenities, check_in_time, check_out_time, admission_fee, estimated_duration, opening_hours, phone, website, review_count, price_level, price_range, business_status, description, added_by, created_at")
        .eq("trip_id", tripId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as Place[]) ?? [];
    },
    enabled: !!tripId,
  });
}
