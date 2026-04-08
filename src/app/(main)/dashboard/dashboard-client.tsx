"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import { toast } from "sonner";
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
import type { TripWithRole } from "@/hooks/use-trips";
import { nanoid } from "nanoid";
import {
  MapPin,
  CalendarDays,
  Compass,
  Share2,
  X,
  Plane,
  Clock,
  CheckCircle2,
  Plus,
  ChevronRight,
  MoreVertical,
  Trash2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TripCardSkeleton } from "@/components/layout/loading-skeleton";
import { useTrips, tripsQueryKey } from "@/hooks/use-trips";
import { cn } from "@/lib/utils";

function getTripStatus(trip: Trip): "upcoming" | "ongoing" | "completed" {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(trip.start_date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(trip.end_date);
  end.setHours(0, 0, 0, 0);
  if (today < start) return "upcoming";
  if (today > end) return "completed";
  return "ongoing";
}

function StatCard({
  icon,
  iconBg,
  label,
  value,
}: {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value: string | number;
}) {
  return (
    <div className="glass-card rounded-2xl p-3 md:p-5 flex flex-col md:flex-row items-center md:items-center gap-2 md:gap-4 text-center md:text-left">
      <div
        className={cn(
          "w-9 h-9 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center shrink-0",
          iconBg
        )}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[9px] md:text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {label}
        </p>
        <p className="text-base md:text-2xl font-bold tracking-tight whitespace-nowrap">
          {value}
        </p>
      </div>
    </div>
  );
}

const statusConfig = {
  upcoming: {
    label: "예정",
    className: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  },
  ongoing: {
    label: "진행중",
    className: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300",
  },
  completed: {
    label: "완료",
    className: "bg-muted text-muted-foreground",
  },
};

export function DashboardClient() {
  const { data: trips = [], isLoading: loading } = useTrips();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const supabase = createClient();
  const queryClient = useQueryClient();
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

  const [title, setTitle] = useState("");
  const [destination, setDestination] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const stats = useMemo(() => {
    const upcoming = trips.filter((t) => getTripStatus(t) === "upcoming");
    const completed = trips.filter((t) => getTripStatus(t) === "completed");

    const nextTrip = [...upcoming].sort(
      (a, b) =>
        new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
    )[0];

    let dday: number | null = null;
    if (nextTrip) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const start = new Date(nextTrip.start_date);
      start.setHours(0, 0, 0, 0);
      dday = Math.ceil(
        (start.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );
    }

    return {
      total: trips.length,
      upcoming: upcoming.length,
      completed: completed.length,
      nextTrip,
      dday,
    };
  }, [trips]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    if (startDate && endDate && endDate < startDate) {
      toast.error("도착일이 출발일보다 이전이에요.");
      return;
    }

    setCreating(true);

    const inviteCode = nanoid(10);

    const { data: tripId, error } = await supabase.rpc(
      "create_trip_with_member",
      {
        p_title: title,
        p_destination: destination,
        p_start_date: startDate,
        p_end_date: endDate,
        p_invite_code: inviteCode,
      }
    );

    if (error || !tripId) {
      toast.error("여행 생성에 실패했어요. 다시 시도해주세요.");
      setCreating(false);
      return;
    }

    setOpen(false);
    setTitle("");
    setDestination("");
    setStartDate("");
    setEndDate("");
    setCreating(false);
    queryClient.invalidateQueries({ queryKey: tripsQueryKey });
    router.push(`/trips/${tripId}/places`);
  }

  function handleDelete(trip: TripWithRole) {
    // 낙관적 업데이트: 즉시 목록에서 제거
    queryClient.setQueryData<TripWithRole[]>(tripsQueryKey, (prev) =>
      (prev ?? []).filter((t) => t.id !== trip.id)
    );

    let undone = false;
    const timeoutId = setTimeout(async () => {
      if (undone) return;
      const res = await fetch(`/api/trips/${trip.id}`, { method: "DELETE" });
      if (!res.ok) {
        // 서버 오류 시 롤백
        queryClient.setQueryData<TripWithRole[]>(tripsQueryKey, (prev) =>
          prev ? [trip, ...prev] : [trip]
        );
        toast.error("삭제에 실패했습니다. 다시 시도해주세요.");
      } else {
        queryClient.invalidateQueries({ queryKey: tripsQueryKey });
      }
    }, 5000);

    toast(`"${trip.title}" 여행을 삭제했습니다`, {
      duration: 5000,
      action: {
        label: "되돌리기",
        onClick: () => {
          undone = true;
          clearTimeout(timeoutId);
          // 낙관적 업데이트 롤백
          queryClient.setQueryData<TripWithRole[]>(tripsQueryKey, (prev) =>
            prev ? [trip, ...prev] : [trip]
          );
        },
      },
    });
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

  function formatDateLong(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("ko-KR", {
      month: "long",
      day: "numeric",
      weekday: "short",
    });
  }

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Hero Section */}
      <Dialog open={open} onOpenChange={setOpen}>
        <section className="relative overflow-hidden rounded-2xl bg-primary p-6 md:p-10">
          <div className="absolute -top-20 -right-20 w-56 h-56 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-12 -left-12 w-40 h-40 rounded-full bg-white/8 blur-2xl" />
          <div className="absolute top-1/2 right-1/4 w-24 h-24 rounded-full bg-white/5 blur-xl" />

          <div className="relative z-10 max-w-xl">
            <h1 className="text-2xl md:text-4xl font-extrabold text-primary-foreground tracking-tight">
              {user?.display_name
                ? `${user.display_name}님,`
                : "안녕하세요!"}
              <br />
              <span className="text-primary-foreground/80">어디로 떠날까요?</span>
            </h1>
            <p className="mt-2 md:mt-3 text-primary-foreground/60 text-sm md:text-base">
              {stats.nextTrip && stats.dday !== null
                ? stats.dday === 0
                  ? `${stats.nextTrip.destination} 여행이 오늘이에요!`
                  : `${stats.nextTrip.destination}까지 ${stats.dday}일 남았어요`
                : stats.total > 0
                  ? `지금까지 ${stats.total}개의 여행을 함께 계획했어요`
                  : "새로운 여행을 계획하고, 함께 떠나보세요"}
            </p>

            <DialogTrigger
              render={
                <Button
                  size="lg"
                  className="mt-5 md:mt-7 bg-white/90 text-primary hover:bg-white shadow-lg font-bold gap-2 rounded-xl"
                />
              }
            >
              <Plus className="w-4 h-4" />
              새 여행 만들기
            </DialogTrigger>
          </div>
        </section>

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

      {/* Stats Grid */}
      {!loading && trips.length > 0 && (
        <section aria-label="여행 통계" className="grid grid-cols-3 gap-2.5 md:gap-5 animate-fade-in-up">
          <StatCard
            icon={<Plane className="w-4 h-4 md:w-5 md:h-5 text-primary" />}
            iconBg="bg-primary/10"
            label="여행"
            value={stats.total}
          />
          <StatCard
            icon={<Clock className="w-4 h-4 md:w-5 md:h-5 text-blue-500" />}
            iconBg="bg-blue-500/10"
            label="예정"
            value={stats.upcoming}
          />
          <StatCard
            icon={
              stats.dday !== null ? (
                <CalendarDays className="w-4 h-4 md:w-5 md:h-5 text-green-500" />
              ) : (
                <CheckCircle2 className="w-4 h-4 md:w-5 md:h-5 text-green-500" />
              )
            }
            iconBg="bg-green-500/10"
            label={stats.dday !== null ? "D-Day" : "완료"}
            value={
              stats.dday !== null
                ? stats.dday === 0
                  ? "Today"
                  : `D-${stats.dday}`
                : stats.completed
            }
          />
        </section>
      )}

      {/* Share Target 배너 */}
      {showShareTip && !loading && trips.length > 0 && (
        <div className="flex items-start gap-3 rounded-2xl glass-card p-4 animate-ios-spring">
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

      {/* Trip List */}
      {loading ? (
        <div className="space-y-4">
          <div className="h-6 w-20 rounded bg-muted animate-pulse" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <TripCardSkeleton key={i} />
            ))}
          </div>
        </div>
      ) : trips.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center animate-fade-in-up">
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
        <section className="animate-fade-in-up">
          <h2 className="text-lg md:text-xl font-bold mb-4">내 여행</h2>

          {/* Desktop: Table rows */}
          <div className="hidden md:block glass-card rounded-2xl overflow-hidden">
            <div className="divide-y divide-glass-border">
              {trips.map((trip) => {
                const status = getTripStatus(trip);
                const config = statusConfig[status];
                const isAdmin = trip.myRole === "admin";
                return (
                  <div
                    key={trip.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`${trip.title} 여행 열기`}
                    className="flex items-center gap-5 px-6 py-4.5 cursor-pointer hover:bg-glass-light/60 transition-colors duration-200 group"
                    onClick={() => router.push(`/trips/${trip.id}/places`)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        router.push(`/trips/${trip.id}/places`);
                      }
                    }}
                  >
                    <div className="w-11 h-11 rounded-xl bg-primary/8 flex items-center justify-center shrink-0">
                      <MapPin className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground truncate">
                        {trip.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {trip.destination}
                      </p>
                    </div>
                    <span className="text-sm text-muted-foreground hidden lg:block whitespace-nowrap">
                      {formatDateLong(trip.start_date)} &mdash;{" "}
                      {formatDateLong(trip.end_date)}
                    </span>
                    <span className="shrink-0 bg-primary/10 text-primary text-xs font-semibold px-2.5 py-1 rounded-full">
                      {getDaysLabel(trip)}
                    </span>
                    <span
                      className={cn(
                        "shrink-0 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide",
                        config.className
                      )}
                    >
                      {config.label}
                    </span>
                    {isAdmin ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          onClick={(e) => e.stopPropagation()}
                          className="shrink-0 p-1.5 rounded-md text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted transition-colors"
                          aria-label="더 보기"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(trip);
                            }}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            여행 삭제
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : (
                      <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Mobile: Cards */}
          <div className="md:hidden grid gap-3 animate-stagger">
            {trips.map((trip) => {
              const status = getTripStatus(trip);
              const config = statusConfig[status];
              const isAdmin = trip.myRole === "admin";
              return (
                <Card
                  key={trip.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`${trip.title} 여행 열기`}
                  className="cursor-pointer hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-300"
                  onClick={() => router.push(`/trips/${trip.id}/places`)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      router.push(`/trips/${trip.id}/places`);
                    }
                  }}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-primary/8 flex items-center justify-center shrink-0 mt-0.5">
                          <MapPin className="w-4 h-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-semibold text-[15px] truncate">
                            {trip.title}
                          </h3>
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            {trip.destination}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide",
                            config.className
                          )}
                        >
                          {config.label}
                        </span>
                        {isAdmin && (
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              onClick={(e) => e.stopPropagation()}
                              className="p-1 rounded-md text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted transition-colors"
                              aria-label="더 보기"
                            >
                              <MoreVertical className="w-3.5 h-3.5" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                variant="destructive"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(trip);
                                }}
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                여행 삭제
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-glass-border">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <CalendarDays className="h-3.5 w-3.5" />
                        <span>
                          {formatDate(trip.start_date)} &mdash;{" "}
                          {formatDate(trip.end_date)}
                        </span>
                      </div>
                      <span className="text-xs font-semibold text-primary/80">
                        {getDaysLabel(trip)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
