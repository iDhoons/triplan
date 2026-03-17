"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { Skeleton } from "@/components/ui/skeleton";
import { ChecklistPage } from "@/components/checklist/checklist-page";
import type { MemberRole } from "@/types/database";

function useMyRole(tripId: string) {
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: ["my_role", tripId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("trip_members")
        .select("role")
        .eq("trip_id", tripId)
        .eq("user_id", user!.id)
        .single();
      if (error) throw error;
      return data.role as MemberRole;
    },
    enabled: !!tripId && !!user,
  });
}

export default function ChecklistRoute() {
  const params = useParams();
  const tripId = params.tripId as string;
  const { data: role, isLoading } = useMyRole(tripId);

  if (isLoading || !role) {
    return (
      <div className="space-y-6 p-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ))}
      </div>
    );
  }

  return <ChecklistPage tripId={tripId} userRole={role} />;
}
