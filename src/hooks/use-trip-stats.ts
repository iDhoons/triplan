import { useQuery } from "@tanstack/react-query";
import type { Profile } from "@/types/database";

interface MemberContribution {
  places: number;
  votes: number;
  checklist: number;
  schedule: number;
  total: number;
}

export interface MemberStat {
  user_id: string;
  role: string;
  profile: Profile | null;
  contributions: MemberContribution;
}

export function useTripStats(tripId: string) {
  return useQuery({
    queryKey: ["trip-stats", tripId],
    queryFn: async (): Promise<MemberStat[]> => {
      const res = await fetch(`/api/trips/${tripId}/stats`);
      if (!res.ok) throw new Error("Failed to fetch stats");
      const json = await res.json();
      return json.stats;
    },
    enabled: !!tripId,
    staleTime: 30_000,
  });
}
