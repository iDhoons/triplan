"use client";

import { useTripStats, type MemberStat } from "@/hooks/use-trip-stats";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { MapPin, ThumbsUp, CheckSquare, Calendar } from "lucide-react";

const CATEGORY_CONFIG = [
  { key: "places" as const, label: "장소", icon: MapPin, color: "bg-blue-500" },
  { key: "votes" as const, label: "투표", icon: ThumbsUp, color: "bg-green-500" },
  { key: "checklist" as const, label: "체크리스트", icon: CheckSquare, color: "bg-amber-500" },
  { key: "schedule" as const, label: "일정", icon: Calendar, color: "bg-purple-500" },
] as const;

function ContributionBar({ stat }: { stat: MemberStat }) {
  const { contributions } = stat;
  const max = Math.max(contributions.total, 1);
  const name = stat.profile?.display_name ?? "멤버";

  return (
    <div className="flex items-center gap-3">
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarImage src={stat.profile?.avatar_url ?? undefined} />
        <AvatarFallback className="text-xs">
          {name.slice(0, 2)}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium truncate">{name}</span>
          <span className="text-xs text-muted-foreground ml-2">
            {contributions.total}건
          </span>
        </div>

        {/* 스택 바 */}
        <div className="flex h-2 rounded-full overflow-hidden bg-muted">
          {CATEGORY_CONFIG.map(({ key, color }) => {
            const value = contributions[key];
            if (value === 0) return null;
            return (
              <div
                key={key}
                className={`${color} transition-all`}
                style={{ width: `${(value / max) * 100}%` }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function MemberContribution({ tripId }: { tripId: string }) {
  const { data: stats, isLoading } = useTripStats(tripId);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3 animate-pulse">
            <div className="h-8 w-8 rounded-full bg-muted" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 bg-muted rounded w-24" />
              <div className="h-2 bg-muted rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!stats?.length) {
    return (
      <p className="text-sm text-muted-foreground text-center py-6">
        아직 활동이 없습니다
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="space-y-4">
        {stats.map((stat) => (
          <ContributionBar key={stat.user_id} stat={stat} />
        ))}
      </div>

      {/* 범례 */}
      <div className="flex flex-wrap gap-3 pt-2">
        {CATEGORY_CONFIG.map(({ key, label, icon: Icon, color }) => (
          <div key={key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className={`h-2 w-2 rounded-full ${color}`} />
            <Icon className="h-3 w-3" />
            <span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
