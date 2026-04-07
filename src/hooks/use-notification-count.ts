"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { queryKeys } from "./query-keys";
import { useAuthStore } from "@/stores/auth-store";

export function useNotificationCount() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  // Realtime 구독: 새 알림 INSERT 시 즉시 카운트 갱신
  useEffect(() => {
    if (!user?.id) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: queryKeys.notifications.count,
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: queryKeys.notifications.count,
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  return useQuery({
    queryKey: queryKeys.notifications.count,
    queryFn: async (): Promise<number> => {
      const res = await fetch("/api/notifications/count");
      if (!res.ok) return 0;
      const json = await res.json();
      return json.unread_count ?? 0;
    },
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    staleTime: 10_000,
    enabled: !!user?.id,
  });
}
