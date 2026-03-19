import { useQuery } from "@tanstack/react-query";
import type { Profile } from "@/types/database";

export interface ChecklistMemberStat {
  user_id: string;
  profile: Profile | null;
  total: number;
  checked: number;
}

interface ChecklistStatsResponse {
  members: ChecklistMemberStat[];
  unassigned: { total: number; checked: number };
  summary: { total: number; checked: number };
}

export function useChecklistStats(tripId: string) {
  return useQuery({
    queryKey: ["checklist-stats", tripId],
    queryFn: async (): Promise<ChecklistStatsResponse> => {
      const res = await fetch(`/api/trips/${tripId}/checklist-stats`);
      if (!res.ok) throw new Error("Failed to fetch checklist stats");
      return res.json();
    },
    enabled: !!tripId,
    staleTime: 30_000,
  });
}
