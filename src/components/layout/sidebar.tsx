"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { globalNav, tripNav, getTripTabHref } from "@/config/navigation";
import { UserMenu } from "./user-menu";

export function Sidebar() {
  const pathname = usePathname();

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

        {/* Trip Local Nav */}
        {currentTripId && (
          <>
            <div className="border-t border-glass-border my-3" />
            <nav aria-label="여행 탭" className="space-y-1">
              <p className="px-3 text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
                현재 여행
              </p>
              {tripNav.map((tab) => {
                const href = getTripTabHref(currentTripId, tab.href);
                const isActive = pathname.includes(
                  `/trips/${currentTripId}/${tab.href}`
                );
                const Icon = tab.icon;
                return (
                  <Link
                    key={tab.href}
                    href={href}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-300",
                      isActive
                        ? "glass-card text-primary font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-glass-light active:scale-[0.98]"
                    )}
                  >
                    <Icon className="w-4 h-4" strokeWidth={isActive ? 2 : 1.5} />
                    {tab.label}
                  </Link>
                );
              })}
            </nav>
          </>
        )}
      </nav>

      {/* User Menu */}
      <div className="border-t border-glass-border px-4 py-3 shrink-0">
        <UserMenu />
      </div>
    </aside>
  );
}
