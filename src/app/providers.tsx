"use client";

import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { useEffect, useState, type ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { ServiceWorkerRegister } from "@/components/layout/sw-register";
import { InstallBanner } from "@/components/layout/install-banner";
import { createIDBPersister } from "@/lib/persister";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000,
            gcTime: 1000 * 60 * 60 * 24, // 24 hours for persistence
            retry: 1,
            networkMode: "offlineFirst",
          },
          mutations: {
            networkMode: "offlineFirst",
          },
        },
      })
  );

  useEffect(() => {
    const splash = document.getElementById("splash");
    if (splash) {
      splash.style.opacity = "0";
      splash.addEventListener(
        "transitionend",
        () => {
          splash.style.display = "none";
        },
        { once: true }
      );
    }
  }, []);

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: createIDBPersister(),
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
        dehydrateOptions: {
          shouldDehydrateQuery: (query) => {
            const key = query.queryKey[0] as string;
            const skipKeys = ["notifications", "trip-stats", "checklist-stats", "activity_logs"];
            return !skipKeys.includes(key);
          },
        },
      }}
      onSuccess={() => {
        queryClient.resumePausedMutations();
      }}
    >
      {children}
      <Toaster position="top-center" richColors />
      <ServiceWorkerRegister />
      <InstallBanner />
    </PersistQueryClientProvider>
  );
}
