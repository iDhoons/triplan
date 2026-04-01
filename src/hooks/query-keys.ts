export const queryKeys = {
  trips: {
    all: ["trips"] as const,
    byId: (tripId: string) => ["trip", tripId] as const,
  },
  places: {
    byTrip: (tripId: string) => ["places", tripId] as const,
  },
  placeVotes: {
    byTrip: (tripId: string) => ["place_votes", tripId] as const,
  },
  schedules: {
    byTrip: (tripId: string) => ["schedules", tripId] as const,
    data: (tripId: string) => ["schedule-data", tripId] as const,
  },
  checklist: {
    byTrip: (tripId: string) => ["checklist", tripId] as const,
    global: ["checklist_global"] as const,
    logs: (itemId: string) => ["checklist_logs", itemId] as const,
  },
  notifications: {
    all: ["notifications"] as const,
    feed: ["notifications", "feed"] as const,
    count: ["notifications", "count"] as const,
  },
  stats: {
    trip: (tripId: string) => ["trip-stats", tripId] as const,
    checklist: (tripId: string) => ["checklist-stats", tripId] as const,
  },
  activity: {
    byTrip: (tripId: string) => ["activity_logs", tripId] as const,
  },
  members: {
    byTrip: (tripId: string) => ["members", tripId] as const,
  },
  myRole: {
    byTrip: (tripId: string) => ["my_role", tripId] as const,
  },
  tripProgress: {
    byTrip: (tripId: string) => ["trip-progress", tripId] as const,
  },
} as const;

// Backward compatibility: dashboard/page.tsx에서 직접 import하므로 re-export 유지
export const tripsQueryKey = queryKeys.trips.all;
