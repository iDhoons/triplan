"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { MapPin, CalendarCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface TripProgressBannerProps {
  tripId: string;
}

interface ProgressData {
  placeCount: number;
  scheduledCount: number;
  totalItemCount: number;
}

/**
 * 여행 완성도를 한 줄로 보여주는 배너.
 * Don Norman: "Knowledge in the World" — 사용자 기억에 의존하지 말고 화면에 정보를 보여줘라.
 */
export function TripProgressBanner({ tripId }: TripProgressBannerProps) {
  const supabase = createClient();

  const { data } = useQuery<ProgressData>({
    queryKey: ["trip-progress", tripId],
    queryFn: async () => {
      const [placesRes] = await Promise.all([
        supabase
          .from("places")
          .select("id", { count: "exact", head: true })
          .eq("trip_id", tripId),
      ]);

      // schedule_items는 schedules를 통해 간접 조회
      const { data: schedules } = await supabase
        .from("schedules")
        .select("id, items:schedule_items(id, place_id)")
        .eq("trip_id", tripId);

      const totalItems = schedules?.reduce(
        (sum, s) => sum + ((s.items as unknown[])?.length ?? 0), 0
      ) ?? 0;

      const scheduledPlaceIds = new Set<string>();
      schedules?.forEach((s) => {
        ((s.items as { id: string; place_id: string | null }[]) ?? []).forEach((item) => {
          if (item.place_id) scheduledPlaceIds.add(item.place_id);
        });
      });

      return {
        placeCount: placesRes.count ?? 0,
        scheduledCount: scheduledPlaceIds.size,
        totalItemCount: totalItems,
      };
    },
    enabled: !!tripId,
    staleTime: 30_000,
  });

  if (!data) return null;

  // 아무것도 없으면 배너 숨김
  if (data.placeCount === 0 && data.totalItemCount === 0) {
    return null;
  }

  const items = [
    {
      icon: MapPin,
      label: `장소 ${data.placeCount}개`,
      done: data.placeCount > 0,
    },
    {
      icon: CalendarCheck,
      label: data.totalItemCount > 0
        ? `일정 ${data.totalItemCount}개`
        : "일정 미편성",
      done: data.totalItemCount > 0,
    },
  ];

  return (
    <div className="flex items-center gap-3 px-1 py-2 text-xs text-muted-foreground overflow-x-auto">
      {items.map((item) => (
        <div
          key={item.label}
          className={cn(
            "flex items-center gap-1 shrink-0",
            item.done && "text-foreground/70"
          )}
        >
          <item.icon className={cn(
            "w-3 h-3",
            item.done ? "text-primary" : "text-muted-foreground/50"
          )} />
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}
