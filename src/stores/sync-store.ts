import { create } from "zustand"

interface PendingAction {
  id: string
  type: string
  payload: unknown
  timestamp: number
  status: "pending" | "syncing" | "failed"
}

interface SyncState {
  pendingActions: PendingAction[]
  isSyncing: boolean
  lastSyncedAt: Date | null
  addPendingAction: (action: Omit<PendingAction, "id" | "timestamp" | "status">) => void
  removePendingAction: (id: string) => void
  setActionStatus: (id: string, status: PendingAction["status"]) => void
  setSyncing: (syncing: boolean) => void
  setLastSyncedAt: (date: Date) => void
  pendingCount: () => number
}

export const useSyncStore = create<SyncState>((set, get) => ({
  pendingActions: [],
  isSyncing: false,
  lastSyncedAt: null,

  addPendingAction: (action) =>
    set((state) => ({
      pendingActions: [
        ...state.pendingActions,
        { ...action, id: crypto.randomUUID(), timestamp: Date.now(), status: "pending" as const },
      ],
    })),

  removePendingAction: (id) =>
    set((state) => ({
      pendingActions: state.pendingActions.filter((a) => a.id !== id),
    })),

  setActionStatus: (id, status) =>
    set((state) => ({
      pendingActions: state.pendingActions.map((a) => (a.id === id ? { ...a, status } : a)),
    })),

  setSyncing: (syncing) => set({ isSyncing: syncing }),
  setLastSyncedAt: (date) => set({ lastSyncedAt: date }),

  pendingCount: () => get().pendingActions.filter((a) => a.status === "pending").length,
}))