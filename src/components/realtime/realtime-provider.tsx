"use client";

import { useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { queryKeys } from "@/hooks/query-keys";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { Place, ScheduleItem, ChecklistItem } from "@/types/database";
import {
  handlePlacesChange,
  handlePlaceVotesChange,
  handleScheduleItemsChange,
  handleChecklistItemsChange,
  type PostgresChangePayload,
} from "./realtime-handlers";

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

  const userIdRef = useRef(user?.id);
  const userRef = useRef(user);
  useEffect(() => {
    userIdRef.current = user?.id;
  }, [user?.id]);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const setupChannel = useCallback(() => {
    if (!tripId) return;

    const supabase = createClient();
    const channelName = `trip:${tripId}`;

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "places", filter: `trip_id=eq.${tripId}` },
        (payload) => {
          handlePlacesChange(
            payload as PostgresChangePayload<Place & Record<string, unknown>>,
            queryClient,
            tripId,
            userIdRef.current,
          );
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "place_votes", filter: `trip_id=eq.${tripId}` },
        (payload) => {
          handlePlaceVotesChange(
            payload as PostgresChangePayload<{ place_id: string } & Record<string, unknown>>,
            queryClient,
            tripId,
          );
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "trip_members", filter: `trip_id=eq.${tripId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: queryKeys.members.byTrip(tripId) });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "schedule_items" },
        (payload) => {
          handleScheduleItemsChange(
            payload as PostgresChangePayload<ScheduleItem & Record<string, unknown>>,
            queryClient,
            tripId,
          );
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "checklist_items", filter: `trip_id=eq.${tripId}` },
        (payload) => {
          handleChecklistItemsChange(
            payload as PostgresChangePayload<ChecklistItem & Record<string, unknown>>,
            queryClient,
            tripId,
            userIdRef.current,
          );
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "checklist_logs" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["checklist_logs"] });
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "activity_logs", filter: `trip_id=eq.${tripId}` },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: queryKeys.activity.byTrip(tripId) });
          presenceEventTarget.dispatchEvent(
            new CustomEvent("activity", { detail: payload.new }),
          );
        },
      )
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
          new CustomEvent("presence_sync", { detail: members }),
        );
      })
      .on("presence", { event: "join" }, ({ newPresences }) => {
        presenceEventTarget.dispatchEvent(
          new CustomEvent("presence_join", { detail: newPresences }),
        );
      })
      .on("presence", { event: "leave" }, ({ leftPresences }) => {
        presenceEventTarget.dispatchEvent(
          new CustomEvent("presence_leave", { detail: leftPresences }),
        );
      })
      .subscribe(async (status) => {
        const currentUser = userRef.current;
        if (status === "SUBSCRIBED" && currentUser) {
          await channel.track({
            userId: currentUser.id,
            displayName: currentUser.display_name,
            avatarUrl: currentUser.avatar_url,
            onlineAt: new Date().toISOString(),
          });
        }
      });

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [tripId, queryClient]);

  useEffect(() => {
    return setupChannel();
  }, [setupChannel]);

  return <>{children}</>;
}
