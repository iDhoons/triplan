import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Budget, Expense, TripMember } from "@/types/database";

export function useBudget(tripId: string) {
  return useQuery({
    queryKey: ["budget", tripId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("budgets")
        .select("*")
        .eq("trip_id", tripId)
        .maybeSingle();
      if (error) throw error;
      return data as Budget | null;
    },
    enabled: !!tripId,
  });
}

export function useExpenses(tripId: string) {
  return useQuery({
    queryKey: ["expenses", tripId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("expenses")
        .select("*, profile:profiles(id, display_name, avatar_url)")
        .eq("trip_id", tripId)
        .order("date", { ascending: false });
      if (error) throw error;
      return (data as Expense[]) ?? [];
    },
    enabled: !!tripId,
  });
}

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
