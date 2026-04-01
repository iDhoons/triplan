"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      process.env.NODE_ENV === "production"
    ) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then(() => {
          // SW 등록 성공
        })
        .catch((error) => {
          console.error("[SW] 등록 실패:", error);
        });
    }
  }, []);

  return null;
}
