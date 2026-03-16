"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Trip, TripMember } from "@/types/database";
import { MapPin, CalendarDays, Users, Sparkles } from "lucide-react";
import { toast } from "sonner";

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

const MAX_MEMBERS = 20; // 여행당 최대 멤버 수

type Status = "loading" | "not-found" | "full" | "already-member" | "ready" | "joining";

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
      router.replace(`/trips/${tripData.id}/places`);
      return;
    }

    // 최대 멤버 수 초과 확인
    if ((count ?? 0) >= MAX_MEMBERS) {
      setStatus("full");
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
      router.push(`/trips/${trip.id}/places`);
      return;
    }

    // 온보딩 메시지 — 신규 참여자에게 첫 행동 안내
    toast.success(`"${trip.title}" 여행에 참여했어요!`, {
      description: "가고 싶은 장소를 추가하거나, AI에게 추천을 받아보세요.",
      duration: 6000,
    });
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

  if (status === "full") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4">
        <p className="text-4xl">👥</p>
        <h1 className="text-xl font-bold text-center">참여 인원이 가득 찼어요</h1>
        <p className="text-sm text-muted-foreground text-center">
          이 여행은 최대 {MAX_MEMBERS}명까지 참여할 수 있어요.
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

        {/* 참여 후 할 수 있는 것 안내 */}
        <div className="space-y-2 px-2">
          <p className="text-xs font-medium text-center text-foreground/80">참여하면 이런 것들을 할 수 있어요</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { icon: MapPin, label: "장소 추가/투표" },
              { icon: CalendarDays, label: "일정 편성" },
              { icon: Users, label: "실시간 협업" },
              { icon: Sparkles, label: "AI 추천" },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Icon className="w-3 h-3 text-primary/60" />
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>

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
