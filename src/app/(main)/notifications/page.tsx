"use client";

import { useRouter } from "next/navigation";
import {
  useNotifications,
  useMarkAsRead,
  useMarkAllAsRead,
} from "@/hooks/use-notifications";
import { Button } from "@/components/ui/button";
import {
  Bell,
  MapPin,
  ThumbsUp,
  Calendar,
  CheckSquare,
  UserPlus,
  Trash2,
  Edit,
  CheckCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Notification } from "@/types/database";

const ACTION_ICONS: Record<string, typeof Bell> = {
  place_added: MapPin,
  place_removed: Trash2,
  place_updated: Edit,
  vote_added: ThumbsUp,
  schedule_item_added: Calendar,
  schedule_item_removed: Calendar,
  checklist_item_added: CheckSquare,
  checklist_checked: CheckSquare,
  checklist_unchecked: CheckSquare,
  checklist_item_removed: Trash2,
  member_joined: UserPlus,
};

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "방금 전";
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}일 전`;
  return new Date(dateStr).toLocaleDateString("ko-KR", {
    month: "short",
    day: "numeric",
  });
}

function NotificationItem({
  notification,
  onRead,
}: {
  notification: Notification;
  onRead: (id: string, tripId: string | null) => void;
}) {
  const Icon = ACTION_ICONS[notification.type] ?? Bell;

  return (
    <button
      onClick={() => onRead(notification.id, notification.trip_id)}
      className={cn(
        "w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50",
        !notification.is_read && "bg-primary/5",
      )}
    >
      <div className="shrink-0 mt-0.5 h-8 w-8 rounded-full bg-muted flex items-center justify-center">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-sm leading-snug",
            !notification.is_read && "font-medium",
          )}
        >
          {notification.title}
        </p>
        {notification.body && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {notification.body}
          </p>
        )}
        <p className="text-xs text-muted-foreground mt-1">
          {formatRelativeTime(notification.created_at)}
        </p>
      </div>
      {!notification.is_read && (
        <div className="shrink-0 mt-2 h-2 w-2 rounded-full bg-primary" />
      )}
    </button>
  );
}

export default function NotificationsPage() {
  const router = useRouter();
  const { data, isLoading, isError, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useNotifications();
  const markAsRead = useMarkAsRead();
  const markAllAsRead = useMarkAllAsRead();

  const notifications = data?.pages.flatMap((p) => p.notifications) ?? [];
  const unreadCount = data?.pages[0]?.unread_count ?? 0;

  function handleRead(id: string, tripId: string | null) {
    markAsRead.mutate(id);
    if (tripId) {
      router.push(`/trips/${tripId}/places`);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-start gap-3 px-4 py-3 animate-pulse">
            <div className="h-8 w-8 rounded-full bg-muted" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 bg-muted rounded w-3/4" />
              <div className="h-2 bg-muted rounded w-1/4" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <p className="text-sm">알림을 불러올 수 없어요. 잠시 후 다시 시도해주세요.</p>
      </div>
    );
  }

  if (!notifications.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <Bell className="w-12 h-12 mb-4" />
        <p className="text-lg font-medium">알림이 없어요</p>
        <p className="text-sm mt-1">여행에서 활동이 생기면 알려드릴게요</p>
      </div>
    );
  }

  return (
    <div className="pb-10">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="text-lg font-semibold">
          알림{" "}
          {unreadCount > 0 && (
            <span className="text-sm font-normal text-muted-foreground">
              {unreadCount}개 안읽음
            </span>
          )}
        </h2>
        {unreadCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => markAllAsRead.mutate()}
            disabled={markAllAsRead.isPending}
          >
            <CheckCheck className="h-4 w-4 mr-1" />
            모두 읽음
          </Button>
        )}
      </div>

      {/* 알림 목록 */}
      <div className="divide-y">
        {notifications.map((n) => (
          <NotificationItem
            key={n.id}
            notification={n}
            onRead={handleRead}
          />
        ))}
      </div>

      {hasNextPage && (
        <button
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
          className="w-full py-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          {isFetchingNextPage ? "불러오는 중..." : "더 보기"}
        </button>
      )}
    </div>
  );
}
