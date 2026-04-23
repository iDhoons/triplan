import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/hooks/query-keys";
import type { Place, Schedule, ScheduleItem, ChecklistItem, Trip } from "@/types/database";

// schedule-data combined query의 캐시 구조
export interface ScheduleDataCache {
  trip: Trip;
  schedules: Schedule[];
  places: Place[];
}

// ---------------------------------------------------------------------------
// Payload type for Supabase Realtime postgres_changes
// ---------------------------------------------------------------------------
export interface PostgresChangePayload<T extends Record<string, unknown>> {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: T | Record<string, never>;
  old: Partial<T> | Record<string, never>;
  schema: string;
  table: string;
  commit_timestamp: string;
  errors: string[];
}

/**
 * ["schedules", tripId] 와 ["schedule-data", tripId] 양쪽 캐시를
 * 동일한 updater로 패치하는 헬퍼.
 */
export function patchSchedulesCache(
  queryClient: QueryClient,
  tripId: string,
  updater: (schedules: Schedule[]) => Schedule[],
) {
  queryClient.setQueryData<Schedule[]>(queryKeys.schedules.byTrip(tripId), (old) =>
    old ? updater(old) : old,
  );
  queryClient.setQueryData<ScheduleDataCache>(
    queryKeys.schedules.data(tripId),
    (old) => {
      if (!old) return old;
      return { ...old, schedules: updater(old.schedules) };
    },
  );
}

// ---------------------------------------------------------------------------
// Selective handler -- places
// ---------------------------------------------------------------------------
export function handlePlacesChange(
  payload: PostgresChangePayload<Place & Record<string, unknown>>,
  queryClient: QueryClient,
  tripId: string,
  userId: string | undefined,
) {
  const placesKey = queryKeys.places.byTrip(tripId);
  const scheduleDataKey = queryKeys.schedules.data(tripId);

  switch (payload.eventType) {
    case "INSERT": {
      queryClient.invalidateQueries({ queryKey: placesKey });
      queryClient.invalidateQueries({ queryKey: scheduleDataKey });
      break;
    }
    case "UPDATE": {
      const updated = payload.new as Place;
      if (userId && updated.added_by === userId) return;

      queryClient.invalidateQueries({ queryKey: queryKeys.places.detail(updated.id) });
      queryClient.setQueryData<Place[]>(placesKey, (old) => {
        if (!old) return old;
        return old.map((p) => (p.id === updated.id ? { ...p, ...updated } : p));
      });
      queryClient.setQueryData<ScheduleDataCache>(scheduleDataKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          places: old.places.map((p) =>
            p.id === updated.id ? { ...p, ...updated } : p,
          ),
        };
      });
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
      queryClient.invalidateQueries({ queryKey: queryKeys.places.detail(deleted.id) });
      queryClient.setQueryData<Place[]>(placesKey, (old) =>
        old?.filter((p) => p.id !== deleted.id),
      );
      queryClient.setQueryData<ScheduleDataCache>(scheduleDataKey, (old) => {
        if (!old) return old;
        return { ...old, places: old.places.filter((p) => p.id !== deleted.id) };
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.schedules.byTrip(tripId) });
      queryClient.invalidateQueries({ queryKey: scheduleDataKey });
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// Selective handler -- place_votes
// ---------------------------------------------------------------------------
export function handlePlaceVotesChange(
  payload: PostgresChangePayload<{ place_id: string } & Record<string, unknown>>,
  queryClient: QueryClient,
  tripId: string,
) {
  const record = (payload.new ?? payload.old) as { place_id?: string };
  if (record.place_id) {
    type PlaceData = { id: string }[];
    const places = queryClient.getQueryData<PlaceData>(queryKeys.places.byTrip(tripId));
    if (places && !places.some((p) => p.id === record.place_id)) {
      return;
    }
  }
  queryClient.invalidateQueries({ queryKey: queryKeys.placeVotes.byTrip(tripId) });
}

// ---------------------------------------------------------------------------
// Selective handler -- schedule_items
// ---------------------------------------------------------------------------
export function handleScheduleItemsChange(
  payload: PostgresChangePayload<ScheduleItem & Record<string, unknown>>,
  queryClient: QueryClient,
  tripId: string,
) {
  const schedulesKey = queryKeys.schedules.byTrip(tripId);
  const scheduleDataKey = queryKeys.schedules.data(tripId);

  const record = (payload.new ?? payload.old) as Partial<ScheduleItem>;
  if (record.schedule_id) {
    const schedules = queryClient.getQueryData<Schedule[]>(schedulesKey);
    if (schedules && !schedules.some((s) => s.id === record.schedule_id)) {
      return;
    }
  }

  switch (payload.eventType) {
    case "INSERT": {
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
export function handleChecklistItemsChange(
  payload: PostgresChangePayload<ChecklistItem & Record<string, unknown>>,
  queryClient: QueryClient,
  tripId: string,
  userId: string | undefined,
) {
  const queryKey = queryKeys.checklist.byTrip(tripId);

  switch (payload.eventType) {
    case "INSERT": {
      const inserted = payload.new as ChecklistItem;
      if (userId && inserted.created_by === userId) return;
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
