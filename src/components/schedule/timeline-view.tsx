"use client";

import { parseISO, format } from "date-fns";
import { ko } from "date-fns/locale";
import { Clock, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Schedule, ScheduleItem } from "@/types/database";

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------
function formatTime(time: string | null): string {
  if (!time) return "--:--";
  return time.slice(0, 5);
}

/** Returns the pixel offset from midnight for a "HH:MM" string. */
function timeToMinutes(time: string | null): number {
  if (!time) return 0;
  const [h, m] = time.split(":").map(Number);
  return h * 60 + (m ?? 0);
}

const HOUR_HEIGHT = 56; // px per hour
const START_HOUR = 6;   // timeline starts at 06:00
const END_HOUR = 24;    // timeline ends at 24:00
const TOTAL_HOURS = END_HOUR - START_HOUR;

// -----------------------------------------------------------------------
// Hour ruler (left column)
// -----------------------------------------------------------------------
function HourRuler() {
  const hours = Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => START_HOUR + i);
  return (
    <div
      className="relative shrink-0 w-12 select-none"
      style={{ height: TOTAL_HOURS * HOUR_HEIGHT }}
    >
      {hours.map((h) => (
        <div
          key={h}
          className="absolute w-full flex items-center justify-end pr-2"
          style={{ top: (h - START_HOUR) * HOUR_HEIGHT - 8 }}
        >
          <span className="text-[11px] text-muted-foreground tabular-nums">
            {String(h % 24).padStart(2, "0")}:00
          </span>
        </div>
      ))}
    </div>
  );
}

// -----------------------------------------------------------------------
// Grid lines
// -----------------------------------------------------------------------
function GridLines() {
  const hours = Array.from({ length: TOTAL_HOURS }, (_, i) => i);
  return (
    <div
      className="absolute inset-0 pointer-events-none"
      aria-hidden="true"
    >
      {hours.map((i) => (
        <div
          key={i}
          className="absolute w-full border-t border-border/40"
          style={{ top: i * HOUR_HEIGHT }}
        />
      ))}
    </div>
  );
}

// -----------------------------------------------------------------------
// Single timeline item block
// -----------------------------------------------------------------------
interface TimelineBlockProps {
  item: ScheduleItem;
  index: number;
  isLast: boolean;
}

function TimelineBlock({ item, index, isLast }: TimelineBlockProps) {
  const startMin = timeToMinutes(item.start_time);
  const endMin = item.end_time
    ? timeToMinutes(item.end_time)
    : startMin + 60; // default 1 hour

  const top = Math.max(0, startMin - START_HOUR * 60) * (HOUR_HEIGHT / 60);
  const height = Math.max(
    HOUR_HEIGHT / 2,
    (endMin - startMin) * (HOUR_HEIGHT / 60)
  );

  const colors = [
    "bg-blue-500/10 border-blue-500/40 text-blue-700 dark:text-blue-300",
    "bg-green-500/10 border-green-500/40 text-green-700 dark:text-green-300",
    "bg-purple-500/10 border-purple-500/40 text-purple-700 dark:text-purple-300",
    "bg-orange-500/10 border-orange-500/40 text-orange-700 dark:text-orange-300",
    "bg-pink-500/10 border-pink-500/40 text-pink-700 dark:text-pink-300",
  ];
  const colorClass = colors[index % colors.length];

  return (
    <>
      {/* Item block */}
      <div
        className={cn(
          "absolute left-0 right-0 rounded-lg border px-2 py-1.5 overflow-hidden",
          colorClass
        )}
        style={{ top, height: Math.max(height, 32), minHeight: 32 }}
      >
        <p className="text-xs font-semibold leading-tight truncate">
          {item.title}
        </p>
        {item.start_time && (
          <p className="text-[10px] mt-0.5 flex items-center gap-0.5 opacity-75">
            <Clock className="w-2.5 h-2.5" />
            {formatTime(item.start_time)}
            {item.end_time && ` ~ ${formatTime(item.end_time)}`}
          </p>
        )}
        {item.place && (
          <p className="text-[10px] opacity-70 truncate mt-0.5">
            {item.place.name}
          </p>
        )}
      </div>

      {/* Transport badge between this item and the next */}
      {!isLast && item.transport_to_next && item.end_time && (
        <div
          className="absolute left-0 right-0 flex items-center justify-center pointer-events-none"
          style={{ top: top + height + 2 }}
        >
          <Badge
            variant="secondary"
            className="text-[10px] gap-1 h-5 z-10"
          >
            <ArrowRight className="w-2.5 h-2.5" />
            {item.transport_to_next}
          </Badge>
        </div>
      )}
    </>
  );
}

// -----------------------------------------------------------------------
// Day timeline section
// -----------------------------------------------------------------------
interface DayTimelineProps {
  schedule: Schedule;
  dayIndex: number;
}

function DayTimeline({ schedule, dayIndex }: DayTimelineProps) {
  const items = (schedule.items ?? []).slice().sort((a, b) => {
    if (a.start_time && b.start_time) return a.start_time.localeCompare(b.start_time);
    return a.sort_order - b.sort_order;
  });

  const dateLabel = format(parseISO(schedule.date), "M/d EEE", { locale: ko });

  return (
    <div className="space-y-3">
      {/* Day header */}
      <div className="flex items-center gap-2 sticky top-0 bg-background/95 backdrop-blur-sm py-1 z-10">
        <span className="text-sm font-bold">Day {dayIndex + 1}</span>
        <span className="text-sm text-muted-foreground">({dateLabel})</span>
        {schedule.day_memo && (
          <span className="text-xs text-muted-foreground">— {schedule.day_memo}</span>
        )}
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2 pl-4">
          이 날짜에는 일정이 없습니다.
        </p>
      ) : (
        <div className="flex gap-3">
          {/* Hour ruler */}
          <HourRuler />

          {/* Timeline grid */}
          <div
            className="relative flex-1"
            style={{ height: TOTAL_HOURS * HOUR_HEIGHT }}
          >
            <GridLines />
            {items.map((item, idx) => (
              <TimelineBlock
                key={item.id}
                item={item}
                index={idx}
                isLast={idx === items.length - 1}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------
// Timeline View
// -----------------------------------------------------------------------
interface TimelineViewProps {
  schedules: Schedule[];
}

export function TimelineView({ schedules }: TimelineViewProps) {
  if (schedules.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
        표시할 일정이 없습니다.
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {schedules.map((schedule, idx) => (
        <DayTimeline key={schedule.id} schedule={schedule} dayIndex={idx} />
      ))}
    </div>
  );
}
