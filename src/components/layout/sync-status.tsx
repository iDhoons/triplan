"use client"

import { useSyncStore } from "@/stores/sync-store"
import { useOnlineStatus } from "@/hooks/use-online-status"
import { Cloud, CloudOff, Loader2 } from "lucide-react"

export function SyncStatus() {
  const isOnline = useOnlineStatus()
  const isSyncing = useSyncStore((s) => s.isSyncing)
  const pendingCount = useSyncStore((s) => s.pendingCount())

  if (!isOnline) {
    return (
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <CloudOff className="w-3.5 h-3.5 text-amber-500" />
        <span>오프라인</span>
        {pendingCount > 0 && <span>({pendingCount})</span>}
      </div>
    )
  }

  if (isSyncing) {
    return (
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
        <span>동기화 중</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1 text-xs text-muted-foreground">
      <Cloud className="w-3.5 h-3.5 text-green-500" />
      <span>동기화됨</span>
    </div>
  )
}
