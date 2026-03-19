"use client";

import { useChecklistStats } from "@/hooks/use-checklist-stats";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { CheckSquare } from "lucide-react";

function ProgressBar({
  checked,
  total,
}: {
  checked: number;
  total: number;
}) {
  const pct = total === 0 ? 0 : Math.round((checked / total) * 100);

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full overflow-hidden bg-muted">
        <div
          className="h-full rounded-full bg-green-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground tabular-nums w-16 text-right">
        {checked}/{total} ({pct}%)
      </span>
    </div>
  );
}

export function ChecklistProgress({ tripId }: { tripId: string }) {
  const { data, isLoading } = useChecklistStats(tripId);

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        {[1, 2].map((i) => (
          <div key={i} className="space-y-1.5">
            <div className="h-3 bg-muted rounded w-20" />
            <div className="h-2 bg-muted rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (!data || data.summary.total === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-6">
        체크리스트가 없습니다
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {/* 전체 진행률 */}
      <div>
        <div className="flex items-center gap-2 mb-1.5">
          <CheckSquare className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">전체</span>
        </div>
        <ProgressBar
          checked={data.summary.checked}
          total={data.summary.total}
        />
      </div>

      {/* 멤버별 진행률 */}
      {data.members.map((member) => {
        const name = member.profile?.display_name ?? "멤버";
        return (
          <div key={member.user_id}>
            <div className="flex items-center gap-2 mb-1.5">
              <Avatar className="h-5 w-5">
                <AvatarImage src={member.profile?.avatar_url ?? undefined} />
                <AvatarFallback className="text-[8px]">
                  {name.slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm">{name}</span>
            </div>
            <ProgressBar checked={member.checked} total={member.total} />
          </div>
        );
      })}

      {/* 미할당 */}
      {data.unassigned.total > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center">
              <span className="text-[8px] text-muted-foreground">?</span>
            </div>
            <span className="text-sm text-muted-foreground">미할당</span>
          </div>
          <ProgressBar
            checked={data.unassigned.checked}
            total={data.unassigned.total}
          />
        </div>
      )}
    </div>
  );
}
