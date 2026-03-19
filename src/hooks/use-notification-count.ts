import { useQuery } from "@tanstack/react-query";

export function useNotificationCount() {
  return useQuery({
    queryKey: ["notifications", "count"],
    queryFn: async (): Promise<number> => {
      const res = await fetch("/api/notifications/count");
      if (!res.ok) return 0;
      const json = await res.json();
      return json.unread_count ?? 0;
    },
    refetchInterval: 30_000, // 30초마다 폴링
    staleTime: 10_000,
  });
}
