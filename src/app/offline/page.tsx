"use client";

import { WifiOff } from "lucide-react";

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="flex flex-col items-center gap-3">
        <WifiOff className="w-16 h-16 text-muted-foreground" />
        <h1 className="text-2xl font-bold">오프라인 상태입니다</h1>
        <p className="text-muted-foreground max-w-sm">
          인터넷 연결을 확인해주세요. 연결이 복구되면 자동으로 다시 시도합니다.
        </p>
      </div>
      <button
        onClick={() => window.location.reload()}
        className="px-6 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
      >
        다시 시도
      </button>
    </div>
  );
}
