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
        .select("id, trip_id, category, name, url, image_urls, latitude, longitude, address, address_components, rating, memo, price_per_night, cancel_policy, amenities, check_in_time, check_out_time, admission_fee, estimated_duration, opening_hours, phone, website, review_count, price_level, price_range, business_status, description, added_by, created_at")
        .eq("trip_id", tripId)
        .order("created_at", { ascending: false });
      console.log("[usePlaces] query result:", { count: data?.length ?? 0, error });
      if (error) {
        console.error("[usePlaces] ⛔ QUERY ERROR:", error.message, error.details, error.hint);
        throw error;
      }
      return (data as Place[]) ?? [];
    },
    enabled: !!tripId,
  });
}
