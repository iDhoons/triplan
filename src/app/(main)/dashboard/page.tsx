"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { UserMenu } from "@/components/layout/user-menu";
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
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">내 여행</h1>
        <div className="flex items-center gap-3">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger
              render={<Button>+ 새 여행</Button>}
            />
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
          <UserMenu />
        </div>
      </header>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="h-32" />
            </Card>
          ))}
        </div>
      ) : trips.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <p className="text-4xl mb-4">🧳</p>
          <p className="text-lg font-medium">아직 여행이 없어요</p>
          <p className="text-sm mt-1">새 여행을 만들어보세요!</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {trips.map((trip) => (
            <Card
              key={trip.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => router.push(`/trips/${trip.id}/places`)}
            >
              <CardContent className="p-5">
                <h3 className="font-semibold text-lg">{trip.title}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {trip.destination}
                </p>
                <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                  <span>
                    {formatDate(trip.start_date)} ~{" "}
                    {formatDate(trip.end_date)}
                  </span>
                  <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                    {getDaysLabel(trip)}
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
