"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { globalNav, tripNav, getTripTabHref } from "@/config/navigation";
import { UserMenu } from "./user-menu";
import { useTrips } from "@/hooks/use-trips";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export function Sidebar() {
  const pathname = usePathname();
  const { data: trips, isLoading, isError, refetch } = useTrips();

  const tripMatch = pathname.match(/\/trips\/([^/]+)/);
  const currentTripId = tripMatch?.[1] ?? null;

  return (
    <aside className="hidden md:flex flex-col w-64 fixed left-0 top-0 bottom-0 border-r glass-nav z-30">
      {/* Logo */}
      <div className="h-14 px-5 flex items-center border-b border-glass-border shrink-0">
        <Link href="/dashboard" className="text-lg font-semibold tracking-tight">
          여행 플래너
        </Link>
      </div>

      {/* Global Nav */}
      <nav aria-label="메인 네비게이션" className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {globalNav.map((item) => {
          const isActive =
            item.href === "/dashboard"
              ? pathname === "/dashboard" || pathname.startsWith("/trips")
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-300",
                isActive
                  ? "glass-card text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-glass-light active:scale-[0.98]"
              )}
            >
              <Icon
                className="w-5 h-5"
                strokeWidth={isActive ? 2 : 1.5}
              />
              {item.label}
            </Link>
          );
        })}

        {/* Trip List */}
        <div className="border-t border-glass-border my-3" />
        <p className="px-3 text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
          내 여행
        </p>

        {isLoading ? (
          <div className="space-y-2 px-1">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-9 rounded-xl" />
            ))}
          </div>
        ) : isError ? (
          <div className="px-3 py-2 text-xs text-muted-foreground">
            <p>목록을 불러오지 못했어요</p>
            <button
              onClick={() => refetch()}
              className="mt-1 text-primary hover:underline"
            >
              다시 시도
            </button>
          </div>
        ) : !trips || trips.length === 0 ? (
          <p className="px-3 py-2 text-xs text-muted-foreground">
            아직 여행이 없어요
          </p>
        ) : (
          <div className="space-y-0.5" role="list" aria-label="여행 목록">
            {trips.map((trip) => {
              const isOpen = currentTripId === trip.id;
              return (
                <Collapsible key={trip.id} open={isOpen}>
                  <CollapsibleTrigger
                    render={
                      <Link
                        href={getTripTabHref(trip.id, "places")}
                        className={cn(
                          "flex items-center gap-2 w-full px-3 py-2 rounded-xl text-sm transition-all duration-300",
                          isOpen
                            ? "text-primary font-medium bg-primary/5"
                            : "text-muted-foreground hover:text-foreground hover:bg-glass-light active:scale-[0.98]"
                        )}
                      />
                    }
                  >
                    <ChevronRight
                      className={cn(
                        "w-3.5 h-3.5 shrink-0 transition-transform duration-200",
                        isOpen && "rotate-90"
                      )}
                      strokeWidth={2}
                    />
                    <span className="truncate">{trip.title}</span>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <nav aria-label={`${trip.title} 탭`} className="ml-3 mt-0.5 space-y-0.5">
                      {tripNav.map((tab) => {
                        const href = getTripTabHref(trip.id, tab.href);
                        const isTabActive = pathname.includes(
                          `/trips/${trip.id}/${tab.href}`
                        );
                        const Icon = tab.icon;
                        return (
                          <Link
                            key={tab.href}
                            href={href}
                            aria-current={isTabActive ? "page" : undefined}
                            className={cn(
                              "flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] transition-all duration-200",
                              isTabActive
                                ? "text-primary font-medium bg-primary/8"
                                : "text-muted-foreground hover:text-foreground hover:bg-glass-light"
                            )}
                          >
                            <Icon className="w-3.5 h-3.5" strokeWidth={isTabActive ? 2 : 1.5} />
                            {tab.label}
                          </Link>
                        );
                      })}
                    </nav>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>
        )}
      </nav>

      {/* User Menu */}
      <div className="border-t border-glass-border px-4 py-3 shrink-0">
        <UserMenu />
      </div>
    </aside>
  );
}
