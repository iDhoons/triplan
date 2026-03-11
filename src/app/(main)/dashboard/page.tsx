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
import { MapPin, CalendarDays, Compass } from "lucide-react";
import { TripCardSkeleton } from "@/components/layout/loading-skeleton";

export default function DashboardPage() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const supabase = createClient();
  const router = useRouter();
  const { user } = useAuthStore();

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
      .select("*")
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

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <TripCardSkeleton key={i} />
          ))}
        </div>
      ) : trips.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-20 text-center animate-fade-in-up">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <Compass className="h-8 w-8 text-primary/60" />
          </div>
          <div className="space-y-1">
            <p className="font-medium text-foreground/80">아직 여행이 없어요</p>
            <p className="text-sm text-muted-foreground">새 여행을 만들어 보세요!</p>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 animate-stagger">
          {trips.map((trip) => (
            <Card
              key={trip.id}
              className="cursor-pointer hover:shadow-lg hover:ring-primary/20 hover:-translate-y-0.5"
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
                  <span className="shrink-0 bg-primary/10 text-primary text-xs font-medium px-2.5 py-1 rounded-full">
                    {getDaysLabel(trip)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-4 pt-3 border-t border-border/50 text-xs text-muted-foreground">
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
