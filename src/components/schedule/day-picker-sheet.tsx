"use client";

import { useRef } from "react";
import { CalendarDays } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { Schedule, Place } from "@/types/database";

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------
function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("ko-KR", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
  });
}

// -----------------------------------------------------------------------
// DayPickerSheet
// -----------------------------------------------------------------------
interface DayPickerSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  place: Place | null;
  schedules: Schedule[];
  onSelect: (scheduleId: string, place: Place) => void;
}

export function DayPickerSheet({
  open,
  onOpenChange,
  place,
  schedules,
  onSelect,
}: DayPickerSheetProps) {
  const triggerRef = useRef<HTMLElement | null>(null);

  /** 트리거 요소를 저장 (포커스 복귀용) */
  function setTriggerElement(el: HTMLElement | null) {
    triggerRef.current = el;
  }

  function handleSelect(scheduleId: string) {
    if (!place) return;
    onSelect(scheduleId, place);
    onOpenChange(false);

    // 포커스 복귀
    requestAnimationFrame(() => {
      triggerRef.current?.focus();
    });
  }

  function handleOpenChange(next: boolean) {
    onOpenChange(next);
    if (!next) {
      requestAnimationFrame(() => {
        triggerRef.current?.focus();
      });
    }
  }

  if (!place) return null;

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="bottom" showCloseButton={false} className="px-0 pb-[env(safe-area-inset-bottom,0px)]">
        <SheetHeader className="px-4 pb-2">
          <SheetTitle className="text-sm">
            {place.name} 일정에 추가
          </SheetTitle>
          <SheetDescription className="text-xs">
            추가할 날짜를 선택하세요
          </SheetDescription>
        </SheetHeader>

        <div role="list" className="px-2 pb-2 max-h-[40vh] overflow-y-auto">
          {schedules.map((schedule, index) => {
            const itemCount = schedule.items?.length ?? 0;
            const firstItems = (schedule.items ?? [])
              .slice(0, 2)
              .map((i) => i.title);

            return (
              <button
                key={schedule.id}
                role="listitem"
                type="button"
                onClick={() => handleSelect(schedule.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left",
                  "transition-colors hover:bg-accent/50 active:bg-accent",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                )}
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                  {index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium">
                      Day {index + 1}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      ({formatDate(schedule.date)})
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {itemCount === 0 ? (
                      <span className="text-primary/70">비어있음</span>
                    ) : (
                      <>
                        {itemCount}개 일정
                        {firstItems.length > 0 && (
                          <span className="ml-1 text-muted-foreground/60">
                            ({firstItems.join(", ")}
                            {itemCount > 2 && " ..."})
                          </span>
                        )}
                      </>
                    )}
                  </p>
                </div>
                <CalendarDays className="w-4 h-4 text-muted-foreground/40 shrink-0" />
              </button>
            );
          })}
        </div>

        {schedules.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            여행 날짜를 먼저 설정해주세요
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

// 트리거 ref setter export
export type { DayPickerSheetProps };
