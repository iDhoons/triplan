import { useInfiniteQuery } from "@tanstack/react-query";
import { queryKeys } from "./query-keys";
import type { ActivityLog } from "@/types/database";

interface ActivityPage {
  activities: ActivityLog[];
  next_cursor: string | null;
}

export function useTripActivity(tripId: string) {
  return useInfiniteQuery({
    queryKey: queryKeys.activity.byTrip(tripId),
    queryFn: async ({ pageParam }): Promise<ActivityPage> => {
      const params = new URLSearchParams({ limit: "20" });
      if (pageParam) params.set("cursor", pageParam);
      const res = await fetch(
        `/api/trips/${tripId}/activity?${params.toString()}`,
      );
      if (!res.ok) throw new Error("Failed to fetch activity");
      return res.json();
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.next_cursor,
    enabled: !!tripId,
    staleTime: 15_000,
  });
}
