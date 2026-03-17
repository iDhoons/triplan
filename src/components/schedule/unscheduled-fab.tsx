"use client";

import { useState } from "react";
import { MapPin, Plus } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { Place, PlaceCategory } from "@/types/database";

// -----------------------------------------------------------------------
// Category helpers
// -----------------------------------------------------------------------
const CATEGORY_EMOJI: Record<PlaceCategory, string> = {
  accommodation: "🏨",
  attraction: "📍",
  restaurant: "🍽",
  other: "📌",
};

// -----------------------------------------------------------------------
// UnscheduledFAB — 모바일 전용 미배치 장소 FAB + Sheet
// -----------------------------------------------------------------------
interface UnscheduledFABProps {
  places: Place[];
  scheduledPlaceIds: Set<string>;
  onAddClick: (place: Place, triggerEl: HTMLElement) => void;
}

export function UnscheduledFAB({
  places,
  scheduledPlaceIds,
  onAddClick,
}: UnscheduledFABProps) {
  const [sheetOpen, setSheetOpen] = useState(false);

  const unscheduledPlaces = places.filter(
    (p) => !scheduledPlaceIds.has(p.id)
  );

  // 미배치 장소가 없으면 FAB 숨김
  if (unscheduledPlaces.length === 0) return null;

  return (
    <>
      {/* FAB 배지 — BottomNav 위 우하단 */}
      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        aria-label={`남은 장소 ${unscheduledPlaces.length}개`}
        className={cn(
          "fixed z-40 md:hidden",
          "right-4 bottom-[calc(58px+env(safe-area-inset-bottom,0px))]",
          "flex items-center gap-1.5 px-3 py-2.5 rounded-full",
          "bg-primary text-primary-foreground shadow-lg",
          "active:scale-95 transition-transform"
        )}
      >
        <MapPin className="w-4 h-4" />
        <span className="text-xs font-semibold">
          남은 장소 {unscheduledPlaces.length}
        </span>
      </button>

      {/* 미배치 장소 목록 Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side="bottom"
          showCloseButton
          className="px-0 pb-[env(safe-area-inset-bottom,0px)]"
        >
          <SheetHeader className="px-4 pb-1">
            <SheetTitle className="text-sm">
              아직 일정에 넣지 않은 장소
            </SheetTitle>
            <SheetDescription className="text-xs">
              + 버튼을 눌러 원하는 날짜에 추가하세요
            </SheetDescription>
          </SheetHeader>

          <ScrollArea className="max-h-[50vh]">
            <div className="px-2 pb-2 space-y-1">
              {unscheduledPlaces.map((place) => (
                <div
                  key={place.id}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg",
                    "hover:bg-accent/50 transition-colors"
                  )}
                >
                  {/* 썸네일 */}
                  {place.image_urls?.[0] ? (
                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={place.image_urls[0]}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <MapPin className="w-4 h-4 text-muted-foreground/40" />
                    </div>
                  )}

                  {/* 장소 정보 */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {place.name}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {CATEGORY_EMOJI[place.category]}{" "}
                      {place.address
                        ? place.address.length > 25
                          ? place.address.slice(0, 25) + "..."
                          : place.address
                        : "주소 없음"}
                    </p>
                  </div>

                  {/* 추가 버튼 */}
                  <button
                    type="button"
                    aria-label={`${place.name} 일정에 추가`}
                    onClick={(e) => {
                      setSheetOpen(false);
                      // Sheet 닫힌 후 DayPickerSheet 열기
                      requestAnimationFrame(() => {
                        onAddClick(place, e.currentTarget);
                      });
                    }}
                    className={cn(
                      "flex items-center justify-center",
                      "w-8 h-8 rounded-full shrink-0",
                      "bg-primary/10 text-primary",
                      "hover:bg-primary/20 active:scale-90 transition-all"
                    )}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </>
  );
}
