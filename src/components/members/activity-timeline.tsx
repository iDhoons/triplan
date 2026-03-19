"use client";

import { useTripActivity } from "@/hooks/use-trip-activity";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import {
  MapPin,
  Trash2,
  ThumbsUp,
  Calendar,
  CheckSquare,
  UserPlus,
  Edit,
} from "lucide-react";
import type { ActivityLog } from "@/types/database";

const ACTION_CONFIG: Record<
  string,
  { icon: typeof MapPin; color: string; label: string }
> = {
  place_added: { icon: MapPin, color: "text-blue-500", label: "장소 추가" },
  place_removed: { icon: Trash2, color: "text-red-500", label: "장소 삭제" },
  place_updated: { icon: Edit, color: "text-blue-400", label: "장소 수정" },
  vote_added: { icon: ThumbsUp, color: "text-green-500", label: "투표" },
  schedule_item_added: { icon: Calendar, color: "text-purple-500", label: "일정 추가" },
  schedule_item_removed: { icon: Calendar, color: "text-red-400", label: "일정 제거" },
  checklist_item_added: { icon: CheckSquare, color: "text-amber-500", label: "체크리스트 추가" },
  checklist_checked: { icon: CheckSquare, color: "text-green-500", label: "완료" },
  checklist_unchecked: { icon: CheckSquare, color: "text-gray-400", label: "완료 취소" },
  checklist_item_removed: { icon: Trash2, color: "text-red-400", label: "체크리스트 삭제" },
  member_joined: { icon: UserPlus, color: "text-indigo-500", label: "참가" },
};

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const diff = now - new Date(dateStr).getTime();
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

function ActivityItem({ log }: { log: ActivityLog }) {
  const config = ACTION_CONFIG[log.action] ?? {
    icon: Edit,
    color: "text-muted-foreground",
    label: "활동",
  };
  const Icon = config.icon;
  const actor = log.profile?.display_name ?? "누군가";
  const targetName =
    (log.metadata?.name as string) ??
    (log.metadata?.title as string) ??
    (log.metadata?.place_name as string) ??
    (log.metadata?.member_name as string) ??
    "";

  return (
    <div className="flex items-start gap-3 py-2">
      <div className="relative shrink-0">
        <Avatar className="h-7 w-7">
          <AvatarImage src={log.profile?.avatar_url ?? undefined} />
          <AvatarFallback className="text-[10px]">
            {actor.slice(0, 2)}
          </AvatarFallback>
        </Avatar>
        <div
          className={`absolute -bottom-0.5 -right-0.5 rounded-full bg-background p-0.5`}
        >
          <Icon className={`h-3 w-3 ${config.color}`} />
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug">
          <span className="font-medium">{actor}</span>
          <span className="text-muted-foreground">
            {" "}
            {config.label}
            {targetName && (
              <>
                {" · "}
                <span className="font-medium">{targetName}</span>
              </>
            )}
          </span>
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {formatRelativeTime(log.created_at)}
        </p>
      </div>
    </div>
  );
}

export function ActivityTimeline({ tripId }: { tripId: string }) {
  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useTripActivity(tripId);

  const activities = data?.pages.flatMap((p) => p.activities) ?? [];

  if (isLoading) {
    return (
      <div className="space-y-3 animate-pulse">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-start gap-3 py-2">
            <div className="h-7 w-7 rounded-full bg-muted" />
            <div className="flex-1 space-y-1">
              <div className="h-3 bg-muted rounded w-3/4" />
              <div className="h-2 bg-muted rounded w-16" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!activities.length) {
    return (
      <p className="text-sm text-muted-foreground text-center py-6">
        아직 활동이 없습니다
      </p>
    );
  }

  return (
    <div>
      <div className="divide-y">
        {activities.map((log) => (
          <ActivityItem key={log.id} log={log} />
        ))}
      </div>

      {hasNextPage && (
        <button
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
          className="w-full py-2 text-sm text-muted-foreground hover:text-foreground transition-colors mt-2"
        >
          {isFetchingNextPage ? "불러오는 중..." : "더 보기"}
        </button>
      )}
    </div>
  );
}
