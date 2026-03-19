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
    refetchInterval: 30_000,
    refetchIntervalInBackground: false, // 탭 비활성 시 폴링 중지
    staleTime: 10_000,
  });
}
