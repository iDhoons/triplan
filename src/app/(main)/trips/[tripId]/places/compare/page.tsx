"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeftIcon, StarIcon, TrophyIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { VoteButton } from "@/components/places/vote-button";
import { cn } from "@/lib/utils";
import type { Place, PlaceVote } from "@/types/database";

// ---- helpers ----------------------------------------------------------------

function formatPrice(n: number | null) {
  if (n === null) return "-";
  return `₩${n.toLocaleString()}`;
}

function formatDuration(mins: number | null) {
  if (mins === null) return "-";
  if (mins < 60) return `${mins}분`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}시간 ${m}분` : `${h}시간`;
}

// 최솟값/최댓값 인덱스
function minIndex(values: (number | null)[]) {
  const nums = values.map((v, i) => (v !== null ? { v, i } : null)).filter(Boolean) as { v: number; i: number }[];
  if (nums.length === 0) return -1;
  return nums.reduce((min, cur) => (cur.v < min.v ? cur : min)).i;
}

function maxIndex(values: (number | null)[]) {
  const nums = values.map((v, i) => (v !== null ? { v, i } : null)).filter(Boolean) as { v: number; i: number }[];
  if (nums.length === 0) return -1;
  return nums.reduce((max, cur) => (cur.v > max.v ? cur : max)).i;
}

// ---- 비교 행 ----------------------------------------------------------------

interface CompareRowProps {
  label: string;
  values: React.ReactNode[];
  highlightIndex?: number;
  highlightVariant?: "best" | "worst";
}

function CompareRow({
  label,
  values,
  highlightIndex,
  highlightVariant,
}: CompareRowProps) {
  return (
    <div className="grid" style={{ gridTemplateColumns: `140px repeat(${values.length}, 1fr)` }}>
      <div className="flex items-center border-b border-r bg-muted/40 px-3 py-3 text-xs font-medium text-muted-foreground">
        {label}
      </div>
      {values.map((val, i) => (
        <div
          key={i}
          className={cn(
            "flex items-center justify-center border-b px-3 py-3 text-sm text-center",
            i < values.length - 1 && "border-r",
            highlightIndex === i && highlightVariant === "best" &&
              "bg-green-50 font-semibold text-green-700 dark:bg-green-950/30 dark:text-green-400",
            highlightIndex === i && highlightVariant === "worst" &&
              "bg-red-50 font-semibold text-red-700 dark:bg-red-950/30 dark:text-red-400"
          )}
        >
          {val}
        </div>
      ))}
    </div>
  );
}

// ---- 투표 현황 ---------------------------------------------------------------

interface VoteStatus {
  placeId: string;
  votes: PlaceVote[];
}

// ---- 메인 페이지 -------------------------------------------------------------

export default function ComparePageWrapper() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-4">
          <div className="h-10 w-32 animate-pulse rounded-lg bg-muted" />
          <div className="h-64 animate-pulse rounded-xl bg-muted" />
        </div>
      }
    >
      <ComparePage />
    </Suspense>
  );
}

function ComparePage() {
  const { tripId } = useParams<{ tripId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const supabase = createClient();

  const ids = (searchParams.get("ids") ?? "").split(",").filter(Boolean);

  const [places, setPlaces] = useState<Place[]>([]);
  const [voteStatuses, setVoteStatuses] = useState<VoteStatus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (ids.length < 2) return;
    fetchData();
  }, [ids.join(",")]);

  async function fetchData() {
    setLoading(true);

    const [placesRes, votesRes] = await Promise.all([
      supabase.from("places").select("*").in("id", ids),
      supabase.from("place_votes").select("*").in("place_id", ids),
    ]);

    if (placesRes.data) {
      // ids 순서 유지
      const sorted = ids
        .map((id) => (placesRes.data as Place[]).find((p) => p.id === id))
        .filter((p): p is Place => !!p);
      setPlaces(sorted);
    }

    if (votesRes.data) {
      const statuses = ids.map((placeId) => ({
        placeId,
        votes: (votesRes.data as PlaceVote[]).filter(
          (v) => v.place_id === placeId
        ),
      }));
      setVoteStatuses(statuses);
    }

    setLoading(false);
  }

  function refreshVotes() {
    fetchData();
  }

  if (ids.length < 2) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-center">
        <p className="text-muted-foreground">비교할 장소를 2개 이상 선택해주세요.</p>
        <Button variant="outline" onClick={() => router.back()}>
          돌아가기
        </Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="h-10 w-32 animate-pulse rounded-lg bg-muted" />
        <div className="h-64 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  const isAccommodation = places.every((p) => p.category === "accommodation");
  const isAttractionOrRestaurant = places.every(
    (p) => p.category === "attraction" || p.category === "restaurant"
  );

  const priceValues = places.map((p) => p.price_per_night);
  const ratingValues = places.map((p) => p.rating);
  const admissionValues = places.map((p) => p.admission_fee);
  const durationValues = places.map((p) => p.estimated_duration);

  const lowestPriceIdx = minIndex(priceValues);
  const highestRatingIdx = maxIndex(ratingValues);
  const lowestAdmissionIdx = minIndex(admissionValues);
  const shortestDurationIdx = minIndex(durationValues);

  const colCount = places.length;
  const gridStyle = {
    gridTemplateColumns: `140px repeat(${colCount}, 1fr)`,
  };

  return (
    <div className="flex flex-col gap-6">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" onClick={() => router.back()}>
          <ArrowLeftIcon />
        </Button>
        <h2 className="text-lg font-semibold">장소 비교</h2>
        <Badge variant="secondary">{places.length}개 장소</Badge>
      </div>

      {/* 비교 테이블 */}
      <div className="overflow-x-auto rounded-xl border">
        {/* 장소 헤더 행 */}
        <div className="grid border-b bg-muted/30" style={gridStyle}>
          <div className="border-r px-3 py-4" />
          {places.map((place) => (
            <div
              key={place.id}
              className="flex flex-col items-center gap-2 border-r px-3 py-4 last:border-r-0"
            >
              {place.image_urls?.length > 0 && (
                <img
                  src={place.image_urls[0]}
                  alt={place.name}
                  className="h-24 w-full rounded-lg object-cover"
                />
              )}
              <p className="text-center text-sm font-semibold leading-snug">
                {place.name}
              </p>
              <Badge
                variant="outline"
                className="text-xs"
              >
                {place.category === "accommodation"
                  ? "숙소"
                  : place.category === "attraction"
                  ? "관광지"
                  : place.category === "restaurant"
                  ? "맛집"
                  : "기타"}
              </Badge>
            </div>
          ))}
        </div>

        {/* 공통 비교 항목 */}
        <CompareRow
          label="평점"
          values={places.map((p) =>
            p.rating !== null ? (
              <span className="flex items-center gap-1">
                <StarIcon className="size-3.5 fill-yellow-400 text-yellow-400" />
                {p.rating}
              </span>
            ) : (
              "-"
            )
          )}
          highlightIndex={highestRatingIdx}
          highlightVariant="best"
        />

        <CompareRow
          label="주소"
          values={places.map((p) => (
            <span className="line-clamp-2 text-xs">{p.address ?? "-"}</span>
          ))}
        />

        {/* 숙소 전용 */}
        {isAccommodation && (
          <>
            <CompareRow
              label="1박 가격"
              values={places.map((p) => formatPrice(p.price_per_night))}
              highlightIndex={lowestPriceIdx}
              highlightVariant="best"
            />
            <CompareRow
              label="취소 정책"
              values={places.map((p) => (
                <span className="text-xs">{p.cancel_policy ?? "-"}</span>
              ))}
            />
            <CompareRow
              label="체크인"
              values={places.map((p) => p.check_in_time ?? "-")}
            />
            <CompareRow
              label="체크아웃"
              values={places.map((p) => p.check_out_time ?? "-")}
            />
            <CompareRow
              label="부대시설"
              values={places.map((p) => (
                <div className="flex flex-wrap justify-center gap-1">
                  {p.amenities?.length > 0
                    ? p.amenities.map((a) => (
                        <Badge key={a} variant="secondary" className="text-xs">
                          {a}
                        </Badge>
                      ))
                    : "-"}
                </div>
              ))}
            />
          </>
        )}

        {/* 관광지 / 맛집 전용 */}
        {isAttractionOrRestaurant && (
          <>
            <CompareRow
              label="입장료"
              values={places.map((p) => formatPrice(p.admission_fee))}
              highlightIndex={lowestAdmissionIdx}
              highlightVariant="best"
            />
            <CompareRow
              label="소요시간"
              values={places.map((p) => formatDuration(p.estimated_duration))}
              highlightIndex={shortestDurationIdx}
              highlightVariant="best"
            />
            <CompareRow
              label="영업시간"
              values={places.map((p) => {
                if (!p.opening_hours) return "-";
                const entries = Object.entries(p.opening_hours);
                return (
                  <div className="flex flex-col gap-0.5 text-xs">
                    {entries.slice(0, 3).map(([day, hours]) => (
                      <span key={day}>
                        <span className="font-medium">{day}</span> {hours}
                      </span>
                    ))}
                    {entries.length > 3 && (
                      <span className="text-muted-foreground">
                        +{entries.length - 3}개
                      </span>
                    )}
                  </div>
                );
              })}
            />
          </>
        )}

        {/* 메모 */}
        <CompareRow
          label="메모"
          values={places.map((p) => (
            <span className="line-clamp-3 text-xs text-muted-foreground">
              {p.memo ?? "-"}
            </span>
          ))}
        />
      </div>

      {/* 투표 섹션 */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <TrophyIcon className="size-5 text-yellow-500" />
          <h3 className="font-semibold">멤버 투표</h3>
        </div>

        <div
          className="grid gap-4"
          style={{ gridTemplateColumns: `repeat(${colCount}, 1fr)` }}
        >
          {places.map((place) => {
            const status = voteStatuses.find((s) => s.placeId === place.id);
            const votes = status?.votes ?? [];

            return (
              <Card key={place.id} className="flex flex-col items-center">
                <CardHeader className="pb-2 text-center">
                  <CardTitle className="line-clamp-2 text-sm">
                    {place.name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-center gap-3">
                  <VoteButton placeId={place.id} />

                  {/* 멤버별 투표 현황 */}
                  {votes.length > 0 && (
                    <div className="w-full">
                      <p className="mb-1.5 text-center text-xs font-medium text-muted-foreground">
                        투표 현황
                      </p>
                      <div className="flex flex-col gap-1">
                        {votes.map((vote) => (
                          <div
                            key={vote.id}
                            className="flex items-center justify-between gap-2"
                          >
                            <span className="truncate text-xs text-muted-foreground">
                              {vote.user_id.slice(0, 8)}...
                            </span>
                            <div className="flex items-center gap-0.5">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <StarIcon
                                  key={star}
                                  className={cn(
                                    "size-3",
                                    star <= vote.vote_type
                                      ? "fill-yellow-400 text-yellow-400"
                                      : "fill-none text-muted-foreground/30"
                                  )}
                                />
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* 하이라이트 범례 */}
      <div className="rounded-lg border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
        <p className="mb-1 font-medium text-foreground">하이라이트 범례</p>
        <div className="flex flex-wrap gap-3">
          <span className="rounded bg-green-50 px-2 py-0.5 text-green-700 dark:bg-green-950/30 dark:text-green-400">
            초록색 = 최적값 (최저가, 최고평점, 최단시간)
          </span>
          <span className="rounded bg-red-50 px-2 py-0.5 text-red-700 dark:bg-red-950/30 dark:text-red-400">
            빨간색 = 최악값
          </span>
        </div>
      </div>
    </div>
  );
}
