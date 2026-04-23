"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  MapPin,
  CalendarDays,
  Users,
  Star,
  UtensilsCrossed,
  Landmark,
  Bed,
  Loader2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import Image from "next/image";

interface GuestPlace {
  id: string;
  name: string;
  category: string;
  image_url: string | null;
  address: string | null;
  rating: number | null;
}

interface GuestScheduleDay {
  date: string;
  items: { title: string; category: string | null }[];
}

interface GuestData {
  trip: {
    title: string;
    destination: string | null;
    start_date: string | null;
    end_date: string | null;
  };
  places: GuestPlace[];
  schedules: GuestScheduleDay[];
  member_count: number;
}

const CATEGORY_ICONS: Record<string, typeof MapPin> = {
  restaurant: UtensilsCrossed,
  attraction: Landmark,
  accommodation: Bed,
  other: MapPin,
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("ko-KR", {
    month: "short",
    day: "numeric",
    weekday: "short",
  });
}

export function GuestTripPreview({ inviteCode }: { inviteCode: string }) {
  const router = useRouter();
  const [data, setData] = useState<GuestData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(`/api/guest/${inviteCode}`)
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [inviteCode]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <p>여행 정보를 불러올 수 없습니다.</p>
      </div>
    );
  }

  const { trip, places, schedules, member_count } = data;

  return (
    <div className="space-y-6 max-w-lg mx-auto px-4 py-8">
      {/* 여행 헤더 */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold">{trip.title}</h1>
        <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
          {trip.destination && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {trip.destination}
            </span>
          )}
          {trip.start_date && trip.end_date && (
            <span className="flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5" />
              {formatDate(trip.start_date)} ~ {formatDate(trip.end_date)}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            {member_count}명
          </span>
        </div>
      </div>

      {/* 장소 목록 */}
      {places.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
            장소 ({places.length})
          </h2>
          <div className="space-y-2">
            {places.slice(0, 6).map((place) => {
              const Icon = CATEGORY_ICONS[place.category] ?? MapPin;
              return (
                <Card key={place.id}>
                  <CardContent className="flex items-center gap-3 py-3 px-4">
                    {place.image_url ? (
                      <Image
                        src={place.image_url}
                        alt={place.name}
                        width={40}
                        height={40}
                        className="h-10 w-10 rounded-md object-cover shrink-0"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center shrink-0">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        {place.name}
                      </p>
                      {place.address && (
                        <p className="text-xs text-muted-foreground truncate">
                          {place.address}
                        </p>
                      )}
                    </div>
                    {place.rating && (
                      <span className="flex items-center gap-0.5 text-xs text-amber-500 shrink-0">
                        <Star className="h-3 w-3 fill-current" />
                        {place.rating}
                      </span>
                    )}
                  </CardContent>
                </Card>
              );
            })}
            {places.length > 6 && (
              <p className="text-xs text-muted-foreground text-center py-2">
                +{places.length - 6}개 장소 더 있음
              </p>
            )}
          </div>
        </div>
      )}

      {/* 일정 요약 */}
      {schedules.some((s) => s.items.length > 0) && (
        <div>
          <h2 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
            일정
          </h2>
          <div className="space-y-3">
            {schedules
              .filter((s) => s.items.length > 0)
              .slice(0, 5)
              .map((day) => (
                <div key={day.date}>
                  <p className="text-xs font-medium text-muted-foreground mb-1">
                    {formatDate(day.date)}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {day.items.map((item, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 text-xs bg-muted px-2 py-1 rounded-full"
                      >
                        {item.title}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* CTA */}
      <div className="space-y-3 pt-4">
        <Button
          className="w-full"
          size="lg"
          onClick={() =>
            router.push(`/signup?next=${encodeURIComponent(`/join/${inviteCode}`)}`)
          }
        >
          가입하고 참여하기
        </Button>
        <p className="text-xs text-muted-foreground text-center">
          이미 계정이 있나요?{" "}
          <button
            onClick={() =>
              router.push(`/login?next=${encodeURIComponent(`/join/${inviteCode}`)}`)
            }
            className="underline hover:text-foreground"
          >
            로그인
          </button>
        </p>
      </div>
    </div>
  );
}
