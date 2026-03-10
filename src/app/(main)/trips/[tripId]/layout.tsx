"use client";

import { useEffect, useState } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { UserMenu } from "@/components/layout/user-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Trip } from "@/types/database";
import { RealtimeProvider } from "@/components/realtime/realtime-provider";
import { OnlineMembers } from "@/components/realtime/online-members";
import { ActivityToast } from "@/components/realtime/activity-toast";

const tabs = [
  { href: "places", label: "장소" },
  { href: "schedule", label: "일정" },
  { href: "budget", label: "예산" },
  { href: "journal", label: "후기" },
  { href: "ai", label: "AI" },
  { href: "members", label: "멤버" },
];

export default function TripLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const tripId = params.tripId as string;
  const [trip, setTrip] = useState<Trip | null>(null);
  const supabase = createClient();

  useEffect(() => {
    async function fetchTrip() {
      const { data } = await supabase
        .from("trips")
        .select("*")
        .eq("id", tripId)
        .single();
      if (data) setTrip(data as Trip);
    }
    fetchTrip();
  }, [tripId]);

  const activeTab = tabs.find((t) =>
    pathname.includes(`/trips/${tripId}/${t.href}`)
  );

  return (
    <RealtimeProvider tripId={tripId}>
      <ActivityToast />
      <div>
        <header className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/dashboard")}
            >
              &larr;
            </Button>
            <div>
              <h1 className="text-xl font-bold">{trip?.title ?? "..."}</h1>
              {trip && (
                <p className="text-xs text-muted-foreground">
                  {trip.destination}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <OnlineMembers />
            <UserMenu />
          </div>
        </header>

        <nav className="flex gap-1 overflow-x-auto border-b mb-6 -mx-4 px-4">
          {tabs.map((tab) => (
            <Link
              key={tab.href}
              href={`/trips/${tripId}/${tab.href}`}
              className={cn(
                "px-3 py-2 text-sm whitespace-nowrap border-b-2 transition-colors",
                activeTab?.href === tab.href
                  ? "border-primary text-primary font-medium"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
            </Link>
          ))}
        </nav>

        {children}
      </div>
    </RealtimeProvider>
  );
}
