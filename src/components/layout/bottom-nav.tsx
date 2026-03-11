"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { globalNav } from "@/config/navigation";

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="앱 메뉴"
      className="fixed bottom-0 left-0 right-0 glass-nav border-t md:hidden z-50 safe-area-bottom"
    >
      <div className="flex justify-around items-center h-[50px]">
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
                "flex flex-col items-center justify-center gap-0.5 w-full h-full text-[10px] transition-all duration-300",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground active:scale-90"
              )}
            >
              <Icon
                className={cn(
                  "w-[22px] h-[22px] transition-all duration-300",
                  isActive && "scale-105"
                )}
                strokeWidth={isActive ? 2.2 : 1.5}
              />
              <span className={cn("font-medium", isActive && "font-semibold")}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
