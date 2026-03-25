export const queryKeys = {
  trips: {
    all: ["trips"] as const,
    byId: (tripId: string) => ["trip", tripId] as const,
  },
  places: {
    byTrip: (tripId: string) => ["places", tripId] as const,
  },
  schedules: {
    data: (tripId: string) => ["schedule-data", tripId] as const,
  },
  checklist: {
    byTrip: (tripId: string) => ["checklist", tripId] as const,
    global: ["checklist_global"] as const,
  },
  notifications: {
    all: ["notifications"] as const,
    count: ["notification-count"] as const,
  },
  stats: {
    trip: (tripId: string) => ["trip-stats", tripId] as const,
    checklist: (tripId: string) => ["checklist-stats", tripId] as const,
  },
  activity: {
    byTrip: (tripId: string) => ["trip-activity", tripId] as const,
  },
  members: {
    byTrip: (tripId: string) => ["trip-members", tripId] as const,
  },
} as const;

// Backward compatibility: dashboard/page.tsx에서 직접 import하므로 re-export 유지
export const tripsQueryKey = queryKeys.trips.all;
