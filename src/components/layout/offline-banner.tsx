"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";
import { toast } from "sonner";

export function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // 초기 상태를 navigator.onLine으로 설정
    setIsOnline(navigator.onLine);
    setMounted(true);

    function handleOnline() {
      setIsOnline(true);
      toast.success("다시 연결되었습니다", {
        description: "인터넷 연결이 복구되었습니다.",
        duration: 3000,
      });
    }

    function handleOffline() {
      setIsOnline(false);
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // SSR 불일치 방지: 마운트 전에는 렌더링하지 않음
  if (!mounted || isOnline) return null;

  return (
    <div className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground shadow-md">
      <WifiOff className="h-4 w-4 shrink-0" />
      <span>오프라인 모드입니다. 일부 기능이 제한될 수 있습니다.</span>
    </div>
  );
}
