"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { tripNav, getTripTabHref } from "@/config/navigation";

interface TripTabNavProps {
  tripId: string;
}

export function TripTabNav({ tripId }: TripTabNavProps) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="여행 탭"
      className="relative flex gap-1 overflow-x-auto border-b mb-6 -mx-4 px-4 scrollbar-hide md:hidden"
      style={{
        maskImage: "linear-gradient(to right, black 85%, transparent)",
        WebkitMaskImage: "linear-gradient(to right, black 85%, transparent)",
      }}
    >
      {tripNav.map((tab) => {
        const href = getTripTabHref(tripId, tab.href);
        const isActive = pathname.includes(`/trips/${tripId}/${tab.href}`);
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 text-sm whitespace-nowrap border-b-2 transition-colors",
              isActive
                ? "border-primary text-primary font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="w-4 h-4" />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
