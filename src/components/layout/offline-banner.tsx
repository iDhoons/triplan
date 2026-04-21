"use client"

import { useOnlineStatus } from "@/hooks/use-online-status"
import { useSyncStore } from "@/stores/sync-store"
import { WifiOff, CloudOff } from "lucide-react"

export function OfflineBanner() {
  const isOnline = useOnlineStatus()
  const pendingCount = useSyncStore((s) => s.pendingCount())
  const isSyncing = useSyncStore((s) => s.isSyncing)

  if (isOnline && !isSyncing) return null

  if (!isOnline) {
    return (
      <div className="bg-amber-500 text-white text-sm text-center py-1.5 px-4 flex items-center justify-center gap-2">
        <WifiOff className="w-4 h-4 shrink-0" />
        <span>오프라인 모드 — 변경사항은 연결 복구 시 동기화됩니다</span>
        {pendingCount > 0 && (
          <span className="bg-amber-700 rounded-full px-2 py-0.5 text-xs">
            {pendingCount}개 대기
          </span>
        )}
      </div>
    )
  }

  if (isSyncing) {
    return (
      <div className="bg-blue-500 text-white text-sm text-center py-1.5 px-4 flex items-center justify-center gap-2">
        <CloudOff className="w-4 h-4 shrink-0 animate-pulse" />
        <span>동기화 중...</span>
      </div>
    )
  }

  return null
}
