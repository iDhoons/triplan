"use client";

import { useState, useEffect, useCallback } from "react";
import { Navigation, X, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGeolocation } from "@/hooks/use-geolocation";
import type { Schedule, ScheduleItem } from "@/types/database";

// ─── 타입 ──────────────────────────────────────────────────────────────────────

interface DirectionsResult {
  duration_seconds: number;
  duration_text: string;
  distance_text: string;
}

interface DepartureInfo {
  item: ScheduleItem;
  /** 현재 위치 기준 실제 이동시간 (초) */
  travelSeconds: number | null;
  /** API 호출 중 여부 */
  isLoading: boolean;
  /** 마지막 갱신 시각 */
  updatedAt: Date | null;
  error: string | null;
}

// ─── 다음 도착지 계산 헬퍼 ───────────────────────────────────────────────────

function findNextItemWithArrival(schedules: Schedule[]): ScheduleItem | null {
  const now = new Date();
  let nearest: ScheduleItem | null = null;

  for (const schedule of schedules) {
    for (const item of schedule.items ?? []) {
      if (
        item.arrival_by &&
        item.place?.latitude &&
        item.place?.longitude &&
        new Date(item.arrival_by) > now
      ) {
        if (!nearest || new Date(item.arrival_by) < new Date(nearest.arrival_by!)) {
          nearest = item;
        }
      }
    }
  }

  return nearest;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────

interface Props {
  schedules: Schedule[];
  className?: string;
}

/**
 * 포그라운드 GPS 보강 — 출발 알림 배너
 * 1. arrival_by가 설정된 다음 일정을 찾는다
 * 2. 현재 GPS 위치 → 목적지까지 Directions API 호출
 * 3. "지금 출발하면 HH:MM 도착 (N분 여유)" 표시
 * 4. 여유 시간이 10분 미만이면 경고 강조
 */
export function DepartureAlert({ schedules, className }: Props) {
  const { coords, isEnabled, isActive, error: geoError, enable, disable } = useGeolocation();
  const [dismissed, setDismissed] = useState(false);
  const [info, setInfo] = useState<DepartureInfo | null>(null);

  const nextItem = findNextItemWithArrival(schedules);

  // 다음 목적지가 바뀌면 dismissed 초기화
  useEffect(() => {
    setDismissed(false);
  }, [nextItem?.id]);

  // Directions API 호출
  const fetchDirections = useCallback(
    async (item: ScheduleItem, lat: number, lng: number) => {
      if (!item.place?.latitude || !item.place?.longitude) return;

      setInfo((prev) => ({ ...prev!, isLoading: true, error: null }));

      try {
        const origin = `${lat},${lng}`;
        const destination = `${item.place.latitude},${item.place.longitude}`;
        const mode = item.travel_mode ?? "transit";

        const res = await fetch(
          `/api/directions?origin=${origin}&destination=${destination}&mode=${mode}`
        );

        if (!res.ok) throw new Error("이동 정보 조회 실패");

        const data: DirectionsResult = await res.json();
        setInfo({
          item,
          travelSeconds: data.duration_seconds,
          isLoading: false,
          updatedAt: new Date(),
          error: null,
        });
      } catch {
        setInfo((prev) =>
          prev
            ? { ...prev, isLoading: false, error: "이동 정보를 가져올 수 없어요." }
            : null
        );
      }
    },
    []
  );

  // GPS 좌표 업데이트 → Directions 재호출 (2분마다 재조회)
  useEffect(() => {
    if (!coords || !nextItem) return;

    const shouldRefresh =
      !info ||
      info.item.id !== nextItem.id ||
      !info.updatedAt ||
      Date.now() - info.updatedAt.getTime() > 2 * 60 * 1000;

    if (shouldRefresh) {
      setInfo({
        item: nextItem,
        travelSeconds: null,
        isLoading: true,
        updatedAt: null,
        error: null,
      });
      void fetchDirections(nextItem, coords.lat, coords.lng);
    }
  }, [coords, nextItem, info, fetchDirections]);

  // 다음 일정이 없으면 렌더 안 함
  if (!nextItem || dismissed) return null;

  // GPS 미활성 상태: 켜기 버튼 표시
  if (!isEnabled || !isActive) {
    return (
      <div
        className={cn(
          "fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-40",
          "flex items-center gap-3 px-4 py-3 rounded-2xl shadow-lg",
          "bg-card border border-border/60 text-sm max-w-sm w-[calc(100%-2rem)]",
          className
        )}
      >
        <Navigation className="size-4 shrink-0 text-muted-foreground" />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground truncate">
            <span className="font-medium text-foreground">{nextItem.title}</span>
            {nextItem.arrival_by && (
              <span className="ml-1">까지 {formatTime(new Date(nextItem.arrival_by))}</span>
            )}
          </p>
          <p className="text-[11px] text-muted-foreground/70">
            GPS를 켜면 실시간 출발 시각을 알려드려요
          </p>
        </div>
        <button
          type="button"
          onClick={enable}
          className="shrink-0 text-xs font-medium text-primary hover:underline"
        >
          켜기
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="shrink-0 text-muted-foreground/50 hover:text-muted-foreground"
          aria-label="닫기"
        >
          <X className="size-3.5" />
        </button>
      </div>
    );
  }

  // GPS 에러
  if (geoError) {
    return null;
  }

  // 이동 정보 계산 중/완료
  const arrivalTime = nextItem.arrival_by ? new Date(nextItem.arrival_by) : null;
  const remainingMs = arrivalTime ? arrivalTime.getTime() - Date.now() : null;
  const remainingMinutes = remainingMs ? Math.floor(remainingMs / 60_000) : null;
  const travelMinutes = info?.travelSeconds ? Math.ceil(info.travelSeconds / 60) : null;
  const marginMinutes =
    travelMinutes !== null && remainingMinutes !== null
      ? remainingMinutes - travelMinutes
      : null;

  const isUrgent = marginMinutes !== null && marginMinutes < 10;
  const isOverdue = marginMinutes !== null && marginMinutes < 0;

  const departureTime =
    arrivalTime && travelMinutes
      ? new Date(arrivalTime.getTime() - travelMinutes * 60_000)
      : null;

  return (
    <div
      className={cn(
        "fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-40",
        "flex items-center gap-3 px-4 py-3 rounded-2xl shadow-lg",
        "text-sm max-w-sm w-[calc(100%-2rem)] transition-colors",
        isOverdue
          ? "bg-destructive text-destructive-foreground border border-destructive"
          : isUrgent
            ? "bg-orange-500 text-white border border-orange-600"
            : "bg-card border border-border/60",
        className
      )}
    >
      <MapPin
        className={cn(
          "size-4 shrink-0",
          isOverdue || isUrgent ? "text-current" : "text-primary"
        )}
      />

      <div className="flex-1 min-w-0 space-y-0.5">
        <p className="font-medium truncate text-sm leading-tight">{nextItem.title}</p>

        {info?.isLoading ? (
          <p className="text-[11px] opacity-70 animate-pulse">이동 시간 계산 중...</p>
        ) : info?.error ? (
          <p className="text-[11px] opacity-70">{info.error}</p>
        ) : departureTime && travelMinutes !== null ? (
          <p className="text-[11px] opacity-90">
            {isOverdue ? (
              <span className="font-semibold">
                지금 바로 출발하세요! ({Math.abs(marginMinutes!)}분 지남)
              </span>
            ) : (
              <>
                {formatTime(departureTime)} 출발 →{" "}
                {arrivalTime && formatTime(arrivalTime)} 도착
                {marginMinutes !== null && (
                  <span className={cn("ml-1", isUrgent ? "font-semibold" : "opacity-70")}>
                    ({marginMinutes}분 여유)
                  </span>
                )}
              </>
            )}
          </p>
        ) : (
          arrivalTime && (
            <p className="text-[11px] opacity-70">
              {formatTime(arrivalTime)}까지 도착
            </p>
          )
        )}
      </div>

      <button
        type="button"
        onClick={disable}
        className={cn(
          "shrink-0 opacity-60 hover:opacity-100",
          isOverdue || isUrgent ? "text-current" : "text-muted-foreground"
        )}
        aria-label="GPS 끄기 및 닫기"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
