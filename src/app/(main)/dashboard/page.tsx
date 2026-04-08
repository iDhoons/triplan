import { HydrationBoundary, QueryClient, dehydrate } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/server";
import { queryKeys } from "@/hooks/query-keys";
import type { Trip, MemberRole } from "@/types/database";
import type { TripWithRole } from "@/hooks/use-trips";
import { DashboardClient } from "./dashboard-client";

async function prefetchTrips(queryClient: QueryClient) {
  await queryClient.prefetchQuery({
    queryKey: queryKeys.trips.all,
    queryFn: async () => {
      const supabase = await createClient();
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
        })) as TripWithRole[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export default async function DashboardPage() {
  const queryClient = new QueryClient();
  await prefetchTrips(queryClient);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DashboardClient />
    </HydrationBoundary>
  );
}
