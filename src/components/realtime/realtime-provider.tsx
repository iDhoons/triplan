"use client";

import { useEffect, useRef, useCallback } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { queryKeys } from "@/hooks/query-keys";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type {
  Place,
  Trip,
  Schedule,
  ScheduleItem,
  ChecklistItem,
} from "@/types/database";

// schedule-data combined query의 캐시 구조
interface ScheduleDataCache {
  trip: Trip;
  schedules: Schedule[];
  places: Place[];
}

/**
 * ["schedules", tripId] 와 ["schedule-data", tripId] 양쪽 캐시를
 * 동일한 updater로 패치하는 헬퍼.
 * schedule-data는 { trip, schedules, places } 구조이므로 내부 schedules만 패치.
 */
function patchSchedulesCache(
  queryClient: QueryClient,
  tripId: string,
  updater: (schedules: Schedule[]) => Schedule[],
) {
  // 1) legacy key (optimistic update용)
  queryClient.setQueryData<Schedule[]>(queryKeys.schedules.byTrip(tripId), (old) =>
    old ? updater(old) : old,
  );
  // 2) combined key (schedule 페이지가 읽는 실제 데이터)
  queryClient.setQueryData<ScheduleDataCache>(
    queryKeys.schedules.data(tripId),
    (old) => {
      if (!old) return old;
      return { ...old, schedules: updater(old.schedules) };
    },
  );
}

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

// ---------------------------------------------------------------------------
// Payload type for Supabase Realtime postgres_changes
// ---------------------------------------------------------------------------
interface PostgresChangePayload<T extends Record<string, unknown>> {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: T | Record<string, never>;
  old: Partial<T> | Record<string, never>;
  schema: string;
  table: string;
  commit_timestamp: string;
  errors: string[];
}

// ---------------------------------------------------------------------------
// Selective handler -- places
// ---------------------------------------------------------------------------
function handlePlacesChange(
  payload: PostgresChangePayload<Place & Record<string, unknown>>,
  queryClient: QueryClient,
  tripId: string,
  userId: string | undefined,
) {
  const placesKey = queryKeys.places.byTrip(tripId);
  const scheduleDataKey = queryKeys.schedules.data(tripId);

  switch (payload.eventType) {
    case "INSERT": {
      // INSERT always needs server refetch (joined fields, defaults)
      queryClient.invalidateQueries({ queryKey: placesKey });
      queryClient.invalidateQueries({ queryKey: scheduleDataKey });
      break;
    }
    case "UPDATE": {
      const updated = payload.new as Place;
      // Skip if self-triggered -- mutation's onSettled already invalidated
      if (userId && updated.added_by === userId) return;

      queryClient.setQueryData<Place[]>(placesKey, (old) => {
        if (!old) return old;
        return old.map((p) => (p.id === updated.id ? { ...p, ...updated } : p));
      });
      // schedule-data 내 places도 패치
      queryClient.setQueryData<ScheduleDataCache>(scheduleDataKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          places: old.places.map((p) =>
            p.id === updated.id ? { ...p, ...updated } : p,
          ),
        };
      });
      // Also patch places nested inside schedule items
      patchSchedulesCache(queryClient, tripId, (schedules) =>
        schedules.map((schedule) => ({
          ...schedule,
          items: schedule.items?.map((item) =>
            item.place?.id === updated.id
              ? { ...item, place: { ...item.place, ...updated } }
              : item,
          ),
        })),
      );
      break;
    }
    case "DELETE": {
      const deleted = payload.old as Partial<Place>;
      if (!deleted.id) {
        queryClient.invalidateQueries({ queryKey: placesKey });
        queryClient.invalidateQueries({ queryKey: scheduleDataKey });
        return;
      }
      queryClient.setQueryData<Place[]>(placesKey, (old) =>
        old?.filter((p) => p.id !== deleted.id),
      );
      // schedule-data 내 places도 패치
      queryClient.setQueryData<ScheduleDataCache>(scheduleDataKey, (old) => {
        if (!old) return old;
        return { ...old, places: old.places.filter((p) => p.id !== deleted.id) };
      });
      // Schedule items referencing this place will show stale data;
      // invalidate schedules to let them refetch cleanly
      queryClient.invalidateQueries({ queryKey: queryKeys.schedules.byTrip(tripId) });
      queryClient.invalidateQueries({ queryKey: scheduleDataKey });
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// Selective handler -- place_votes
// Only invalidate ["place_votes", tripId]. Never touch ["places", tripId].
// VoteButton manages its own local state via direct Supabase fetch.
// ---------------------------------------------------------------------------
function handlePlaceVotesChange(
  payload: PostgresChangePayload<{ place_id: string } & Record<string, unknown>>,
  queryClient: QueryClient,
  tripId: string,
) {
  // 현재 trip의 place인지 확인 — 다른 trip 이벤트는 무시
  const record = (payload.new ?? payload.old) as { place_id?: string };
  if (record.place_id) {
    type PlaceData = { id: string }[];
    const places = queryClient.getQueryData<PlaceData>(queryKeys.places.byTrip(tripId));
    if (places && !places.some((p) => p.id === record.place_id)) {
      return; // 다른 trip의 vote 이벤트 → skip
    }
  }
  queryClient.invalidateQueries({ queryKey: queryKeys.placeVotes.byTrip(tripId) });
}

// ---------------------------------------------------------------------------
// Selective handler -- schedule_items (nested inside schedules query)
// ---------------------------------------------------------------------------
function handleScheduleItemsChange(
  payload: PostgresChangePayload<ScheduleItem & Record<string, unknown>>,
  queryClient: QueryClient,
  tripId: string,
) {
  const schedulesKey = queryKeys.schedules.byTrip(tripId);
  const scheduleDataKey = queryKeys.schedules.data(tripId);

  // 현재 trip의 schedule인지 확인 — 다른 trip 이벤트는 무시
  const record = (payload.new ?? payload.old) as Partial<ScheduleItem>;
  if (record.schedule_id) {
    const schedules = queryClient.getQueryData<Schedule[]>(schedulesKey);
    if (schedules && !schedules.some((s) => s.id === record.schedule_id)) {
      return; // 다른 trip의 schedule_item 이벤트 → skip
    }
  }

  switch (payload.eventType) {
    case "INSERT": {
      // INSERT needs full refetch to include nested place join
      queryClient.invalidateQueries({ queryKey: schedulesKey });
      queryClient.invalidateQueries({ queryKey: scheduleDataKey });
      break;
    }
    case "UPDATE": {
      const updated = payload.new as ScheduleItem;
      if (!updated.schedule_id) {
        queryClient.invalidateQueries({ queryKey: schedulesKey });
        queryClient.invalidateQueries({ queryKey: scheduleDataKey });
        return;
      }

      const oldRecord = payload.old as Partial<ScheduleItem>;
      const scheduleChanged =
        oldRecord.schedule_id && oldRecord.schedule_id !== updated.schedule_id;

      const updater = (schedules: Schedule[]): Schedule[] => {
        if (scheduleChanged) {
          // Cross-day move: remove from old schedule, add to new one
          return schedules.map((schedule) => {
            if (schedule.id === oldRecord.schedule_id) {
              return {
                ...schedule,
                items: schedule.items?.filter((i) => i.id !== updated.id),
              };
            }
            if (schedule.id === updated.schedule_id) {
              const existingItem = schedules
                .flatMap((s) => s.items ?? [])
                .find((i) => i.id === updated.id);
              const movedItem = existingItem
                ? { ...existingItem, ...updated, place: existingItem.place }
                : null;
              if (!movedItem) return schedule;
              const items = [...(schedule.items ?? []), movedItem].sort(
                (a, b) => a.sort_order - b.sort_order,
              );
              return { ...schedule, items };
            }
            return schedule;
          });
        }

        // Same schedule: patch in place
        return schedules.map((schedule) => {
          if (!schedule.items) return schedule;
          const idx = schedule.items.findIndex((i) => i.id === updated.id);
          if (idx === -1) return schedule;
          const updatedItems = [...schedule.items];
          updatedItems[idx] = {
            ...updatedItems[idx],
            ...updated,
            place: updatedItems[idx].place,
          };
          return {
            ...schedule,
            items: updatedItems.sort((a, b) => a.sort_order - b.sort_order),
          };
        });
      };

      patchSchedulesCache(queryClient, tripId, updater);
      break;
    }
    case "DELETE": {
      const deleted = payload.old as Partial<ScheduleItem>;
      if (!deleted.id) {
        queryClient.invalidateQueries({ queryKey: schedulesKey });
        queryClient.invalidateQueries({ queryKey: scheduleDataKey });
        return;
      }
      patchSchedulesCache(queryClient, tripId, (schedules) =>
        schedules.map((schedule) => ({
          ...schedule,
          items: schedule.items?.filter((i) => i.id !== deleted.id),
        })),
      );
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// Selective handler -- checklist_items
// ---------------------------------------------------------------------------
function handleChecklistItemsChange(
  payload: PostgresChangePayload<ChecklistItem & Record<string, unknown>>,
  queryClient: QueryClient,
  tripId: string,
  userId: string | undefined,
) {
  const queryKey = queryKeys.checklist.byTrip(tripId);

  switch (payload.eventType) {
    case "INSERT": {
      const inserted = payload.new as ChecklistItem;
      // Skip if self-triggered (optimistic update already added it)
      if (userId && inserted.created_by === userId) return;
      // INSERT needs refetch for joined fields (assignee profile)
      queryClient.invalidateQueries({ queryKey });
      break;
    }
    case "UPDATE": {
      const updated = payload.new as ChecklistItem;

      queryClient.setQueryData<ChecklistItem[]>(queryKey, (old) => {
        if (!old) return old;
        return old.map((item) =>
          item.id === updated.id
            ? { ...item, ...updated, assignee: item.assignee }
            : item,
        );
      });
      break;
    }
    case "DELETE": {
      const deleted = payload.old as Partial<ChecklistItem>;
      if (!deleted.id) {
        queryClient.invalidateQueries({ queryKey });
        return;
      }
      queryClient.setQueryData<ChecklistItem[]>(queryKey, (old) =>
        old?.filter((item) => item.id !== deleted.id),
      );
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export function RealtimeProvider({ tripId, children }: RealtimeProviderProps) {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Stable refs so callback closures always have the latest user data.
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
      // ---------------------------------------------------------------
      // places -- eventType별 선택적 처리
      // ---------------------------------------------------------------
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "places",
          filter: `trip_id=eq.${tripId}`,
        },
        (payload) => {
          handlePlacesChange(
            payload as PostgresChangePayload<Place & Record<string, unknown>>,
            queryClient,
            tripId,
            userIdRef.current,
          );
        },
      )
      // ---------------------------------------------------------------
      // place_votes -- place_votes만 invalidate, places는 건드리지 않음
      // ---------------------------------------------------------------
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "place_votes",
        },
        (payload) => {
          handlePlaceVotesChange(
            payload as PostgresChangePayload<{ place_id: string } & Record<string, unknown>>,
            queryClient,
            tripId,
          );
        },
      )
      // ---------------------------------------------------------------
      // trip_members -- 기존 동작 유지
      // ---------------------------------------------------------------
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "trip_members",
          filter: `trip_id=eq.${tripId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: queryKeys.members.byTrip(tripId) });
        },
      )
      // ---------------------------------------------------------------
      // schedule_items -- eventType별 선택적 처리
      // ---------------------------------------------------------------
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "schedule_items",
        },
        (payload) => {
          handleScheduleItemsChange(
            payload as PostgresChangePayload<ScheduleItem & Record<string, unknown>>,
            queryClient,
            tripId,
          );
        },
      )
      // ---------------------------------------------------------------
      // checklist_items -- eventType별 선택적 처리
      // ---------------------------------------------------------------
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "checklist_items",
          filter: `trip_id=eq.${tripId}`,
        },
        (payload) => {
          handleChecklistItemsChange(
            payload as PostgresChangePayload<ChecklistItem & Record<string, unknown>>,
            queryClient,
            tripId,
            userIdRef.current,
          );
        },
      )
      // ---------------------------------------------------------------
      // checklist_logs -- 기존 동작 유지 (INSERT only)
      // ---------------------------------------------------------------
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "checklist_logs",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["checklist_logs"] });
        },
      )
      // ---------------------------------------------------------------
      // activity_logs -- 기존 동작 유지 (INSERT only)
      // ---------------------------------------------------------------
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
            queryKey: queryKeys.activity.byTrip(tripId),
          });
          // ActivityToast가 수신할 수 있도록 이벤트 발행
          presenceEventTarget.dispatchEvent(
            new CustomEvent("activity", { detail: payload.new }),
          );
        },
      )
      // ---------------------------------------------------------------
      // Presence -- 기존 동작 유지
      // ---------------------------------------------------------------
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
