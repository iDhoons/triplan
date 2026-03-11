"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import type { RealtimeChannel } from "@supabase/supabase-js";

interface RealtimeProviderProps {
  tripId: string;
  children: React.ReactNode;
}

export interface PresenceMember {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  onlineAt: string;
}

// 전역 presence 상태를 공유하기 위한 이벤트 채널
export const presenceEventTarget = new EventTarget();

export function RealtimeProvider({ tripId, children }: RealtimeProviderProps) {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!tripId) return;

    const supabase = createClient();
    const channelName = `trip:${tripId}`;

    const channel = supabase
      .channel(channelName)
      // places 테이블 변경 구독
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "places",
          filter: `trip_id=eq.${tripId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["places", tripId] });
        }
      )
      // place_votes 테이블 변경 구독
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "place_votes",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["places", tripId] });
          queryClient.invalidateQueries({ queryKey: ["place_votes", tripId] });
        }
      )
      // budgets 테이블 변경 구독
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "budgets",
          filter: `trip_id=eq.${tripId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["budget", tripId] });
        }
      )
      // expenses 테이블 변경 구독
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "expenses",
          filter: `trip_id=eq.${tripId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["expenses", tripId] });
        }
      )
      // trip_members 테이블 변경 구독
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "trip_members",
          filter: `trip_id=eq.${tripId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["members", tripId] });
        }
      )
      // schedule_items 테이블 변경 구독
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "schedule_items",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["schedules", tripId] });
        }
      )
      // activity_logs 테이블 변경 구독
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "activity_logs",
          filter: `trip_id=eq.${tripId}`,
        },
        (payload) => {
          queryClient.invalidateQueries({
            queryKey: ["activity_logs", tripId],
          });
          // ActivityToast가 수신할 수 있도록 이벤트 발행
          presenceEventTarget.dispatchEvent(
            new CustomEvent("activity", { detail: payload.new })
          );
        }
      )
      // Presence: 현재 접속 멤버 동기화
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<{
          userId: string;
          displayName: string;
          avatarUrl: string | null;
          onlineAt: string;
        }>();

        const members: PresenceMember[] = Object.values(state)
          .flat()
          .map((p) => ({
            userId: p.userId,
            displayName: p.displayName,
            avatarUrl: p.avatarUrl,
            onlineAt: p.onlineAt,
          }));

        presenceEventTarget.dispatchEvent(
          new CustomEvent("presence_sync", { detail: members })
        );
      })
      .on("presence", { event: "join" }, ({ newPresences }) => {
        presenceEventTarget.dispatchEvent(
          new CustomEvent("presence_join", { detail: newPresences })
        );
      })
      .on("presence", { event: "leave" }, ({ leftPresences }) => {
        presenceEventTarget.dispatchEvent(
          new CustomEvent("presence_leave", { detail: leftPresences })
        );
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED" && user) {
          await channel.track({
            userId: user.id,
            displayName: user.display_name,
            avatarUrl: user.avatar_url,
            onlineAt: new Date().toISOString(),
          });
        }
      });

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [tripId, user, queryClient]);

  return <>{children}</>;
}
