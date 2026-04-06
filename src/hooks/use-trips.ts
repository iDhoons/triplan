import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Trip, MemberRole } from "@/types/database";
import { queryKeys } from "./query-keys";

// Backward compatibility: dashboard/page.tsx 등에서 직접 사용
export { tripsQueryKey } from "./query-keys";

export interface TripWithRole extends Trip {
  myRole: MemberRole;
}

export function useTrips() {
  return useQuery<TripWithRole[]>({
    queryKey: queryKeys.trips.all,
    queryFn: async () => {
      const supabase = createClient();
      // trip_members를 통해 내 멤버십 + 여행 정보를 한 번에 가져옴
      const { data, error } = await supabase
        .from("trip_members")
        .select(
          "role, trip:trips(id, title, destination, start_date, end_date, cover_image_url, invite_code, created_by, created_at, updated_at)"
        )
        .order("created_at", { referencedTable: "trips", ascending: false });
      if (error) throw error;
      return (data ?? [])
        .filter((m) => m.trip !== null)
        .map((m) => ({
          ...(m.trip as unknown as Trip),
          myRole: m.role as MemberRole,
        }));
    },
    staleTime: 5 * 60 * 1000,
  });
}
