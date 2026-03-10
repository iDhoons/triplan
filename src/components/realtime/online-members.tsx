"use client";

import { useEffect, useState } from "react";
import { presenceEventTarget, type PresenceMember } from "./realtime-provider";
import { cn } from "@/lib/utils";

interface OnlineMembersProps {
  className?: string;
}

const MAX_VISIBLE = 5;

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// 아바타 배경 색상을 userId 기준으로 고정
const AVATAR_COLORS = [
  "bg-rose-500",
  "bg-orange-500",
  "bg-amber-500",
  "bg-emerald-500",
  "bg-teal-500",
  "bg-sky-500",
  "bg-indigo-500",
  "bg-violet-500",
  "bg-pink-500",
];

function getAvatarColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

export function OnlineMembers({ className }: OnlineMembersProps) {
  const [members, setMembers] = useState<PresenceMember[]>([]);
  const [tooltip, setTooltip] = useState<string | null>(null);

  useEffect(() => {
    function handleSync(e: Event) {
      const event = e as CustomEvent<PresenceMember[]>;
      // userId 기준으로 중복 제거
      const unique = Array.from(
        new Map(event.detail.map((m) => [m.userId, m])).values()
      );
      setMembers(unique);
    }

    presenceEventTarget.addEventListener("presence_sync", handleSync);
    return () => {
      presenceEventTarget.removeEventListener("presence_sync", handleSync);
    };
  }, []);

  if (members.length === 0) return null;

  const visible = members.slice(0, MAX_VISIBLE);
  const overflow = members.length - MAX_VISIBLE;

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {/* 아바타 겹침 목록 */}
      <div className="flex -space-x-2">
        {visible.map((member) => (
          <div
            key={member.userId}
            className="relative cursor-default"
            onMouseEnter={() => setTooltip(member.userId)}
            onMouseLeave={() => setTooltip(null)}
          >
            {/* 아바타 */}
            {member.avatarUrl ? (
              <img
                src={member.avatarUrl}
                alt={member.displayName}
                className="w-8 h-8 rounded-full border-2 border-background object-cover"
              />
            ) : (
              <div
                className={cn(
                  "w-8 h-8 rounded-full border-2 border-background flex items-center justify-center text-white text-xs font-semibold",
                  getAvatarColor(member.userId)
                )}
              >
                {getInitials(member.displayName)}
              </div>
            )}

            {/* 온라인 표시 점 */}
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-background" />

            {/* 툴팁 */}
            {tooltip === member.userId && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded shadow-md whitespace-nowrap z-50 border">
                {member.displayName}
              </div>
            )}
          </div>
        ))}

        {/* +N 오버플로우 표시 */}
        {overflow > 0 && (
          <div className="w-8 h-8 rounded-full border-2 border-background bg-muted flex items-center justify-center text-muted-foreground text-xs font-semibold">
            +{overflow}
          </div>
        )}
      </div>

      {/* 접속자 수 텍스트 */}
      <span className="text-xs text-muted-foreground ml-1">
        {members.length}명 접속 중
      </span>
    </div>
  );
}
