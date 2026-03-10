"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OnlineMembers } from "@/components/realtime/online-members";
import type { Trip } from "@/types/database";

interface TripHeaderProps {
  trip: Trip | null;
  onEditClick: () => void;
}

export function TripHeader({ trip, onEditClick }: TripHeaderProps) {
  const router = useRouter();

  return (
    <header className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          aria-label="대시보드로 돌아가기"
          onClick={() => router.push("/dashboard")}
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <button
          type="button"
          className="text-left group"
          onClick={onEditClick}
          aria-label="여행 정보 수정"
        >
          <div className="flex items-center gap-1.5">
            <h1 className="text-xl font-bold">{trip?.title ?? "..."}</h1>
            <Pencil className="w-3.5 h-3.5 text-muted-foreground opacity-60 group-hover:opacity-100 transition-opacity" />
          </div>
          {trip && (
            <p className="text-xs text-muted-foreground">
              {trip.destination} · {trip.start_date} ~ {trip.end_date}
            </p>
          )}
        </button>
      </div>
      <div className="flex items-center gap-3">
        <OnlineMembers />
      </div>
    </header>
  );
}
