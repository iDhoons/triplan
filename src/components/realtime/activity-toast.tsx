"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { presenceEventTarget } from "./realtime-provider";
import { useAuthStore } from "@/stores/auth-store";
import type { ActivityLog } from "@/types/database";

// action 코드를 사람이 읽기 좋은 문장으로 변환
function formatAction(log: ActivityLog): string {
  const actor = log.profile?.display_name ?? "누군가";
  const targetName =
    (log.metadata?.target_name as string) ?? log.target_type ?? "항목";

  switch (log.action) {
    case "place_added":
      return `${actor}이(가) '${targetName}'을(를) 추가했습니다`;
    case "place_removed":
      return `${actor}이(가) '${targetName}'을(를) 삭제했습니다`;
    case "place_updated":
      return `${actor}이(가) '${targetName}'을(를) 수정했습니다`;
    case "vote_added":
      return `${actor}이(가) '${targetName}'에 투표했습니다`;
    case "schedule_updated":
      return `${actor}이(가) 일정을 수정했습니다`;
    case "schedule_item_added":
      return `${actor}이(가) 일정에 '${targetName}'을(를) 추가했습니다`;
    case "schedule_item_removed":
      return `${actor}이(가) 일정에서 '${targetName}'을(를) 제거했습니다`;
    case "expense_added":
      return `${actor}이(가) 지출 '${targetName}'을(를) 기록했습니다`;
    case "member_joined":
      return `${actor}이(가) 여행에 참여했습니다`;
    default:
      return `${actor}이(가) 활동했습니다`;
  }
}

export function ActivityToast() {
  const currentUser = useAuthStore((s) => s.user);

  useEffect(() => {
    function handleActivity(e: Event) {
      const event = e as CustomEvent<ActivityLog>;
      const log = event.detail;

      // 자기 자신의 활동은 무시
      if (currentUser && log.user_id === currentUser.id) return;

      const message = formatAction(log);
      toast(message, {
        duration: 4000,
        position: "top-right",
        icon: "👤",
      });
    }

    presenceEventTarget.addEventListener("activity", handleActivity);
    return () => {
      presenceEventTarget.removeEventListener("activity", handleActivity);
    };
  }, [currentUser]);

  // UI를 렌더링하지 않음 - sonner Toaster는 providers.tsx에서 전역 등록됨
  return null;
}
