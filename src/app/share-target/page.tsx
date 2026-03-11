"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import type { Trip } from "@/types/database";

const STICKY_CONTEXT_KEY = "share-target-last-trip";
const STICKY_TIMEOUT_MS = 30 * 60 * 1000; // 30분

interface StickyContext {
  tripId: string;
  timestamp: number;
}

function getStickyTrip(): string | null {
  try {
    const raw = localStorage.getItem(STICKY_CONTEXT_KEY);
    if (!raw) return null;
    const ctx: StickyContext = JSON.parse(raw);
    if (Date.now() - ctx.timestamp > STICKY_TIMEOUT_MS) {
      localStorage.removeItem(STICKY_CONTEXT_KEY);
      return null;
    }
    return ctx.tripId;
  } catch {
    return null;
  }
}

function setStickyTrip(tripId: string) {
  localStorage.setItem(
    STICKY_CONTEXT_KEY,
    JSON.stringify({ tripId, timestamp: Date.now() })
  );
}

export default function ShareTargetPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center p-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      }
    >
      <ShareTargetContent />
    </Suspense>
  );
}

function ShareTargetContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const sharedUrl =
    searchParams.get("url") ||
    searchParams.get("text") ||
    "";

  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedTripName, setSavedTripName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<{
    placeId: string;
    name: string;
  } | null>(null);

  // 여행 목록 로드
  useEffect(() => {
    if (!user) return;
    const supabase = createClient();

    async function loadTrips() {
      const { data: memberships } = await supabase
        .from("trip_members")
        .select("trip_id")
        .eq("user_id", user!.id);

      if (!memberships?.length) {
        setTrips([]);
        setLoading(false);
        return;
      }

      const tripIds = memberships.map((m) => m.trip_id);
      const { data: tripsData } = await supabase
        .from("trips")
        .select("*")
        .in("id", tripIds)
        .order("updated_at", { ascending: false });

      setTrips(tripsData ?? []);
      setLoading(false);
    }

    loadTrips();
  }, [user]);

  // 여행 1개 또는 점착성 맥락 → 자동 저장
  useEffect(() => {
    if (loading || !sharedUrl || trips.length === 0) return;

    if (trips.length === 1) {
      handleSave(trips[0]);
      return;
    }

    const stickyTripId = getStickyTrip();
    if (stickyTripId) {
      const trip = trips.find((t) => t.id === stickyTripId);
      if (trip) {
        handleSave(trip);
        return;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, trips, sharedUrl]);

  const handleSave = useCallback(
    async (trip: Trip) => {
      if (!sharedUrl || saving) return;
      setSaving(true);
      setError(null);

      try {
        const res = await fetch("/api/places/share", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: sharedUrl, trip_id: trip.id }),
        });

        const data = await res.json();

        if (data.duplicate) {
          setDuplicate({ placeId: data.place_id, name: data.name });
          setSaving(false);
          return;
        }

        if (!res.ok) {
          throw new Error(data.error ?? "저장에 실패했습니다");
        }

        setStickyTrip(trip.id);
        setSavedTripName(trip.title);
      } catch (err) {
        setError(err instanceof Error ? err.message : "저장에 실패했습니다");
      } finally {
        setSaving(false);
      }
    },
    [sharedUrl, saving]
  );

  // 미인증 → 로그인
  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardContent className="flex flex-col items-center gap-4 pt-6">
            <p className="text-sm text-muted-foreground">
              로그인이 필요합니다
            </p>
            <Button
              onClick={() =>
                router.push(
                  `/login?redirect=${encodeURIComponent(`/share-target?url=${encodeURIComponent(sharedUrl)}`)}`
                )
              }
            >
              로그인
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // URL 없음
  if (!sharedUrl) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardContent className="flex flex-col items-center gap-4 pt-6">
            <p className="text-sm text-muted-foreground">
              공유된 URL이 없습니다
            </p>
            <Button onClick={() => router.push("/dashboard")}>
              대시보드로 이동
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 로딩
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // 저장 완료
  if (savedTripName) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardContent className="flex flex-col items-center gap-4 pt-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <span className="text-xl">✓</span>
            </div>
            <p className="text-sm font-medium">
              &ldquo;{savedTripName}&rdquo;에 저장됨
            </p>
            <p className="max-w-[250px] truncate text-xs text-muted-foreground">
              {sharedUrl}
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  // 점착성 맥락 해제 + 여행 선택 UI 표시
                  setSavedTripName(null);
                }}
              >
                다른 여행으로
              </Button>
              <Button
                size="sm"
                onClick={() => router.push("/dashboard")}
              >
                확인
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 중복 URL
  if (duplicate) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardContent className="flex flex-col items-center gap-4 pt-6">
            <p className="text-sm">이미 저장된 장소입니다</p>
            <p className="text-xs font-medium">{duplicate.name}</p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => router.push("/dashboard")}
              >
                확인
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setDuplicate(null);
                  // 다른 여행 선택으로 돌아가기
                }}
              >
                다른 여행에 추가
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 여행 0개
  if (trips.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardContent className="flex flex-col items-center gap-4 pt-6">
            <p className="text-sm text-muted-foreground">
              아직 여행이 없습니다
            </p>
            <Button onClick={() => router.push("/dashboard")}>
              여행 만들러 가기
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 여행 2개+ → 선택 UI (바텀시트 스타일)
  return (
    <div className="flex min-h-screen items-end justify-center bg-black/40 p-4 sm:items-center">
      <Card className="w-full max-w-sm animate-in slide-in-from-bottom-4">
        <CardContent className="flex flex-col gap-3 pt-6">
          <p className="text-sm font-medium">어떤 여행에 저장할까요?</p>
          <p className="max-w-full truncate text-xs text-muted-foreground">
            {sharedUrl}
          </p>

          <div className="flex flex-col gap-2">
            {trips.map((trip, i) => (
              <button
                key={trip.id}
                onClick={() => handleSave(trip)}
                disabled={saving}
                className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-accent ${
                  i === 0
                    ? "border-primary/50 bg-primary/5"
                    : "border-border"
                }`}
              >
                <div className="flex-1">
                  <p className="text-sm font-medium">{trip.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {trip.destination} · {trip.start_date} ~ {trip.end_date}
                  </p>
                </div>
                {i === 0 && (
                  <span className="text-xs text-primary">추천</span>
                )}
              </button>
            ))}
          </div>

          {saving && (
            <p className="text-center text-xs text-muted-foreground">
              저장 중...
            </p>
          )}

          {error && (
            <p className="text-center text-xs text-destructive">{error}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
