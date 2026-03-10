"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Trip, TripMember } from "@/types/database";
import { MapPin, CalendarDays, Users } from "lucide-react";

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function getDaysNights(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  const nights = Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
  return `${nights}박 ${nights + 1}일`;
}

type Status = "loading" | "not-found" | "already-member" | "ready" | "joining";

export default function JoinPage() {
  const params = useParams();
  const inviteCode = params.inviteCode as string;
  const router = useRouter();
  const { user } = useAuthStore();
  const supabase = createClient();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [memberCount, setMemberCount] = useState(0);
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    initialize();
  }, [inviteCode]);

  async function initialize() {
    // Redirect to login if not authenticated
    if (!user) {
      router.push(
        `/login?next=${encodeURIComponent(`/join/${inviteCode}`)}`
      );
      return;
    }

    // Fetch trip by invite code
    const { data: tripData } = await supabase
      .from("trips")
      .select("*")
      .eq("invite_code", inviteCode)
      .maybeSingle();

    if (!tripData) {
      setStatus("not-found");
      return;
    }

    setTrip(tripData as Trip);

    // Check member count
    const { count } = await supabase
      .from("trip_members")
      .select("*", { count: "exact", head: true })
      .eq("trip_id", tripData.id);
    setMemberCount(count ?? 0);

    // Check if current user is already a member
    const { data: existing } = await supabase
      .from("trip_members")
      .select("id")
      .eq("trip_id", tripData.id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing) {
      // Already a member → go directly
      router.replace(`/trips/${tripData.id}/places`);
      return;
    }

    setStatus("ready");
  }

  async function handleJoin() {
    if (!trip || !user) return;
    setStatus("joining");

    const { error } = await supabase.from("trip_members").insert({
      trip_id: trip.id,
      user_id: user.id,
      role: "editor",
    });

    if (error) {
      // Might be a race condition duplicate – redirect anyway
      router.push(`/trips/${trip.id}/places`);
      return;
    }

    router.push(`/trips/${trip.id}/places`);
  }

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground text-sm">잠시만요...</p>
      </div>
    );
  }

  if (status === "not-found") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4">
        <p className="text-4xl">🔍</p>
        <h1 className="text-xl font-bold text-center">초대 링크를 찾을 수 없어요</h1>
        <p className="text-sm text-muted-foreground text-center">
          링크가 만료되었거나 잘못된 주소예요.
        </p>
        <Button variant="outline" onClick={() => router.push("/dashboard")}>
          대시보드로 이동
        </Button>
      </div>
    );
  }

  if (!trip) return null;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12 bg-muted/30">
      <div className="w-full max-w-md space-y-6">
        {/* Invite header */}
        <div className="text-center space-y-1">
          <p className="text-sm text-muted-foreground">여행에 초대받으셨어요!</p>
          <h1 className="text-2xl font-bold">참여하시겠어요?</h1>
        </div>

        {/* Trip card */}
        <Card className="shadow-md">
          {trip.cover_image_url && (
            <div className="w-full h-40 overflow-hidden rounded-t-xl">
              <img
                src={trip.cover_image_url}
                alt={trip.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <CardHeader className="pb-3">
            <CardTitle className="text-xl">{trip.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="w-4 h-4 shrink-0" />
              <span>{trip.destination}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CalendarDays className="w-4 h-4 shrink-0" />
              <span>
                {formatDate(trip.start_date)} ~ {formatDate(trip.end_date)}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CalendarDays className="w-4 h-4 shrink-0 opacity-0" />
              <span className="bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full font-medium">
                {getDaysNights(trip.start_date, trip.end_date)}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="w-4 h-4 shrink-0" />
              <span>현재 {memberCount}명 참여 중</span>
            </div>
          </CardContent>
        </Card>

        {/* Role notice */}
        <p className="text-xs text-muted-foreground text-center">
          참여하면 <strong>편집자</strong> 권한으로 일정, 장소 등을 함께 편집할 수 있어요.
        </p>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <Button
            size="lg"
            className="w-full text-base"
            onClick={handleJoin}
            disabled={status === "joining"}
          >
            {status === "joining" ? "참여 중..." : "참여하기"}
          </Button>
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => router.push("/dashboard")}
          >
            나중에
          </Button>
        </div>
      </div>
    </div>
  );
}
