import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Notification } from "@/types/database";

interface NotificationPage {
  notifications: Notification[];
  next_cursor: string | null;
  unread_count: number;
}

export function useNotifications() {
  return useInfiniteQuery({
    queryKey: ["notifications", "feed"],
    queryFn: async ({ pageParam }): Promise<NotificationPage> => {
      const params = new URLSearchParams({ limit: "20" });
      if (pageParam) params.set("cursor", pageParam);
      const res = await fetch(`/api/notifications?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch notifications");
      return res.json();
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.next_cursor,
    staleTime: 15_000,
  });
}

export function useMarkAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/notifications/${id}/read`, {
        method: "PATCH",
      });
      if (!res.ok) throw new Error("Failed to mark as read");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useMarkAllAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/notifications/read-all", {
        method: "PATCH",
      });
      if (!res.ok) throw new Error("Failed to mark all as read");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}
