"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Trip } from "@/types/database";
import { nanoid } from "nanoid";
import { MapPin, CalendarDays, Compass, Share2, X } from "lucide-react";
import { TripCardSkeleton } from "@/components/layout/loading-skeleton";

export default function DashboardPage() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const supabase = createClient();
  const router = useRouter();
  const { user } = useAuthStore();

  const [showShareTip, setShowShareTip] = useState(() => {
    if (typeof window === "undefined") return false;
    return !localStorage.getItem("hide-share-tip");
  });

  function dismissShareTip() {
    localStorage.setItem("hide-share-tip", "1");
    setShowShareTip(false);
  }

  // 폼 상태
  const [title, setTitle] = useState("");
  const [destination, setDestination] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    fetchTrips();
  }, []);

  async function fetchTrips() {
    const { data } = await supabase
      .from("trips")
      .select("id, title, destination, start_date, end_date, created_at")
      .order("created_at", { ascending: false });

    if (data) setTrips(data as Trip[]);
    setLoading(false);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setCreating(true);

    const inviteCode = nanoid(10);

    const { data: tripId, error } = await supabase.rpc("create_trip_with_member", {
      p_title: title,
      p_destination: destination,
      p_start_date: startDate,
      p_end_date: endDate,
      p_invite_code: inviteCode,
    });

    if (error || !tripId) {
      setCreating(false);
      return;
    }

    setOpen(false);
    setTitle("");
    setDestination("");
    setStartDate("");
    setEndDate("");
    setCreating(false);
    router.push(`/trips/${tripId}/places`);
  }

  function getDaysLabel(trip: Trip) {
    const start = new Date(trip.start_date);
    const end = new Date(trip.end_date);
    const nights = Math.ceil(
      (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
    );
    return `${nights}박${nights + 1}일`;
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("ko-KR", {
      month: "short",
      day: "numeric",
    });
  }

  return (
    <div>
      <header className="flex items-center justify-between mb-8">
        <h1 className="text-2xl sm:text-3xl">내 여행</h1>
        <div className="flex items-center gap-3">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={<Button>+ 새 여행</Button>} />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>새 여행 만들기</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label>여행 이름</Label>
                  <Input
                    placeholder="오사카 가족여행"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>여행지</Label>
                  <Input
                    placeholder="오사카, 일본"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>출발일</Label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>도착일</Label>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={creating}>
                  {creating ? "만드는 중..." : "만들기"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      {/* Share Target 온보딩 배너 */}
      {showShareTip && !loading && trips.length > 0 && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl glass-card p-4 animate-ios-spring">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 glass-light">
            <Share2 className="h-4.5 w-4.5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">
              네이버 지도, 구글맵에서 공유 버튼만 누르면 장소가 자동 저장됩니다
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              앱을 설치하면 다른 앱에서 바로 공유할 수 있어요
            </p>
          </div>
          <button
            onClick={dismissShareTip}
            className="shrink-0 rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="닫기"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <TripCardSkeleton key={i} />
          ))}
        </div>
      ) : trips.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-20 text-center animate-fade-in-up">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 glass-light">
            <Compass className="h-8 w-8 text-primary/60" />
          </div>
          <div className="space-y-1">
            <p className="font-medium text-foreground/80">아직 여행이 없어요</p>
            <p className="text-sm text-muted-foreground">
              새 여행을 만들고, 네이버 지도나 구글맵에서 장소를 공유해보세요
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 animate-stagger">
          {trips.map((trip) => (
            <Card
              key={trip.id}
              className="cursor-pointer hover:-translate-y-1 active:scale-[0.97] transition-all duration-300"
              onClick={() => router.push(`/trips/${trip.id}/places`)}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-base truncate">{trip.title}</h3>
                    <div className="flex items-center gap-1.5 mt-1.5 text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      <span className="text-sm truncate">{trip.destination}</span>
                    </div>
                  </div>
                  <span className="shrink-0 bg-primary/12 text-primary text-xs font-semibold px-2.5 py-1 rounded-full glass-light">
                    {getDaysLabel(trip)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-4 pt-3 border-t border-glass-border text-xs text-muted-foreground">
                  <CalendarDays className="h-3.5 w-3.5" />
                  <span>
                    {formatDate(trip.start_date)} ~ {formatDate(trip.end_date)}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
