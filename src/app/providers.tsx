"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { ServiceWorkerRegister } from "@/components/layout/sw-register";
import { InstallBanner } from "@/components/layout/install-banner";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000,
            gcTime: 10 * 60 * 1000,
            retry: 1,
          },
        },
      })
  );

  useEffect(() => {
    const splash = document.getElementById("splash");
    if (splash) {
      splash.style.opacity = "0";
      splash.addEventListener("transitionend", () => splash.remove(), {
        once: true,
      });
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster position="top-center" richColors />
      <ServiceWorkerRegister />
      <InstallBanner />
    </QueryClientProvider>
  );
}
