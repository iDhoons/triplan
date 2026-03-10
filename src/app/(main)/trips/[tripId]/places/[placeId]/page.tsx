"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { ko } from "date-fns/locale";
import {
  ArrowLeft,
  MapPin,
  Star,
  Phone,
  Globe,
  Clock,
  ChevronLeft,
  ChevronRight,
  CalendarPlus,
  Pencil,
  Trash2,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { VoteButton } from "@/components/places/vote-button";
import { PlaceMap } from "@/components/maps/place-map";
import type {
  Place,
  PlaceCategory,
  PlaceVote,
  Schedule,
  Profile,
} from "@/types/database";

const CATEGORY_LABELS: Record<PlaceCategory, string> = {
  accommodation: "숙소",
  attraction: "관광지",
  restaurant: "맛집",
  other: "기타",
};

const CATEGORY_COLORS: Record<PlaceCategory, string> = {
  accommodation: "bg-blue-100 text-blue-800",
  attraction: "bg-green-100 text-green-800",
  restaurant: "bg-orange-100 text-orange-800",
  other: "bg-gray-100 text-gray-800",
};

export default function PlaceDetailPage() {
  const { tripId, placeId } = useParams<{
    tripId: string;
    placeId: string;
  }>();
  const router = useRouter();
  const supabase = createClient();
  const user = useAuthStore((s) => s.user);

  const [place, setPlace] = useState<Place | null>(null);
  const [votes, setVotes] = useState<(PlaceVote & { profile?: Profile })[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [selectedScheduleId, setSelectedScheduleId] = useState("");
  const [comment, setComment] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [placeRes, votesRes, schedulesRes] = await Promise.all([
      supabase.from("places").select("*").eq("id", placeId).single(),
      supabase
        .from("place_votes")
        .select("*, profile:profiles(*)")
        .eq("place_id", placeId)
        .order("created_at", { ascending: false }),
      supabase
        .from("schedules")
        .select("*")
        .eq("trip_id", tripId)
        .order("date"),
    ]);

    if (placeRes.data) setPlace(placeRes.data as Place);
    if (votesRes.data)
      setVotes(votesRes.data as (PlaceVote & { profile?: Profile })[]);
    if (schedulesRes.data) setSchedules(schedulesRes.data as Schedule[]);
    setLoading(false);
  }, [placeId, tripId, supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleDelete() {
    if (!place || !confirm(`"${place.name}"을(를) 삭제하시겠습니까?`)) return;
    const { error } = await supabase.from("places").delete().eq("id", place.id);
    if (!error) {
      toast.success("장소가 삭제되었습니다.");
      router.push(`/trips/${tripId}/places`);
    }
  }

  async function handleAddToSchedule() {
    if (!selectedScheduleId || !place) return;
    const { error } = await supabase.from("schedule_items").insert({
      schedule_id: selectedScheduleId,
      place_id: place.id,
      title: place.name,
      sort_order: 999,
    });
    if (error) {
      toast.error("일정 추가에 실패했습니다.");
      return;
    }
    toast.success("일정에 추가했습니다!");
    setScheduleDialogOpen(false);
  }

  async function handleSubmitComment() {
    if (!user || !comment.trim()) return;
    setSubmittingComment(true);

    const existingVote = votes.find((v) => v.user_id === user.id);
    if (existingVote) {
      await supabase
        .from("place_votes")
        .update({ comment: comment.trim() })
        .eq("id", existingVote.id);
    } else {
      await supabase.from("place_votes").insert({
        place_id: placeId,
        user_id: user.id,
        vote_type: 3,
        comment: comment.trim(),
      });
    }

    setComment("");
    setSubmittingComment(false);
    fetchData();
    toast.success("코멘트를 남겼습니다.");
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!place) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        장소를 찾을 수 없습니다.
      </div>
    );
  }

  const photos = place.image_urls ?? [];
  const hasCoords = place.latitude != null && place.longitude != null;

  // 메모에서 전화번호, 웹사이트 파싱
  const memoLines = (place.memo ?? "").split("\n");
  const phoneLine = memoLines.find((l) => l.startsWith("전화:"));
  const websiteLine = memoLines.find((l) => l.startsWith("웹사이트:"));
  const reviewLine = memoLines.find((l) => l.includes("리뷰"));
  const otherMemo = memoLines
    .filter(
      (l) =>
        !l.startsWith("전화:") &&
        !l.startsWith("웹사이트:") &&
        !l.includes("리뷰") &&
        l.trim()
    )
    .join("\n");

  const avgVote =
    votes.length > 0
      ? (votes.reduce((sum, v) => sum + v.vote_type, 0) / votes.length).toFixed(
          1
        )
      : null;

  return (
    <div className="space-y-6 pb-20">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/trips/${tripId}/places`)}
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{place.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge className={CATEGORY_COLORS[place.category]} variant="outline">
              {CATEGORY_LABELS[place.category]}
            </Badge>
            {place.rating && (
              <span className="flex items-center gap-1 text-sm">
                <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                {place.rating}
                {reviewLine && (
                  <span className="text-xs text-muted-foreground">
                    ({reviewLine.replace("리뷰 ", "").replace("개", "")}개)
                  </span>
                )}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 사진 갤러리 */}
      {photos.length > 0 && (
        <div className="relative rounded-xl overflow-hidden bg-muted">
          <img
            src={photos[photoIndex]}
            alt={`${place.name} ${photoIndex + 1}`}
            className="w-full h-64 sm:h-80 object-cover"
          />
          {photos.length > 1 && (
            <>
              <button
                onClick={() =>
                  setPhotoIndex((i) => (i - 1 + photos.length) % photos.length)
                }
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 text-white rounded-full p-1.5 hover:bg-black/70"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={() =>
                  setPhotoIndex((i) => (i + 1) % photos.length)
                }
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 text-white rounded-full p-1.5 hover:bg-black/70"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
              <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full">
                {photoIndex + 1} / {photos.length}
              </div>
            </>
          )}
        </div>
      )}

      {/* 액션 버튼 */}
      <div className="flex gap-2 flex-wrap">
        <Button
          size="sm"
          onClick={() => setScheduleDialogOpen(true)}
          className="gap-1.5"
        >
          <CalendarPlus className="w-4 h-4" />
          일정에 추가
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            router.push(`/trips/${tripId}/places?edit=${place.id}`)
          }
          className="gap-1.5"
        >
          <Pencil className="w-4 h-4" />
          수정
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-red-500 hover:text-red-700"
          onClick={handleDelete}
        >
          <Trash2 className="w-4 h-4" />
          삭제
        </Button>
        {place.url && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => window.open(place.url!, "_blank")}
          >
            <ExternalLink className="w-4 h-4" />
            Google Maps
          </Button>
        )}
      </div>

      {/* 기본 정보 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">기본 정보</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {place.address && (
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" />
              <span>{place.address}</span>
            </div>
          )}
          {phoneLine && (
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 shrink-0 text-muted-foreground" />
              <a
                href={`tel:${phoneLine.replace("전화: ", "")}`}
                className="text-primary underline"
              >
                {phoneLine.replace("전화: ", "")}
              </a>
            </div>
          )}
          {websiteLine && (
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 shrink-0 text-muted-foreground" />
              <a
                href={websiteLine.replace("웹사이트: ", "")}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline truncate"
              >
                {websiteLine.replace("웹사이트: ", "")}
              </a>
            </div>
          )}

          {/* 숙소 전용 */}
          {place.category === "accommodation" && (
            <>
              {place.price_per_night && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">1박:</span>
                  <span className="font-semibold">
                    {place.price_per_night.toLocaleString()}원
                  </span>
                </div>
              )}
              {(place.check_in_time || place.check_out_time) && (
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 shrink-0 text-muted-foreground" />
                  {place.check_in_time && (
                    <span>체크인 {place.check_in_time}</span>
                  )}
                  {place.check_out_time && (
                    <span>체크아웃 {place.check_out_time}</span>
                  )}
                </div>
              )}
              {place.cancel_policy && (
                <div className="text-xs text-muted-foreground">
                  취소정책: {place.cancel_policy}
                </div>
              )}
              {place.amenities.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {place.amenities.map((a) => (
                    <Badge key={a} variant="secondary" className="text-xs">
                      {a}
                    </Badge>
                  ))}
                </div>
              )}
            </>
          )}

          {/* 관광지/맛집 전용 */}
          {(place.category === "attraction" ||
            place.category === "restaurant") && (
            <>
              {place.admission_fee != null && (
                <div>
                  입장료: {place.admission_fee.toLocaleString()}원
                </div>
              )}
              {place.estimated_duration != null && (
                <div>소요시간: 약 {place.estimated_duration}분</div>
              )}
              {place.opening_hours && (
                <div className="space-y-0.5">
                  <span className="text-muted-foreground text-xs">
                    영업시간:
                  </span>
                  {Object.entries(
                    place.opening_hours as Record<string, string>
                  ).map(([day, hours]) => (
                    <div key={day} className="text-xs pl-2">
                      {day}: {hours}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {otherMemo && (
            <>
              <Separator />
              <p className="text-muted-foreground whitespace-pre-wrap">
                {otherMemo}
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {/* 지도 */}
      {hasCoords && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">위치</CardTitle>
          </CardHeader>
          <CardContent>
            <PlaceMap places={[place]} className="h-64 rounded-lg" />
          </CardContent>
        </Card>
      )}

      {/* 멤버 투표 + 코멘트 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            멤버 평가
            {avgVote && (
              <span className="text-sm font-normal text-muted-foreground ml-2">
                평균 {avgVote}점 ({votes.length}명)
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 내 투표 */}
          <div className="flex items-center gap-3">
            <span className="text-sm">내 평가:</span>
            <VoteButton placeId={placeId} />
          </div>

          <Separator />

          {/* 코멘트 입력 */}
          <div className="flex gap-2">
            <Textarea
              placeholder="한줄 코멘트 (예: 위치 좋고 조식 맛있음)"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
              className="resize-none text-sm"
            />
            <Button
              size="sm"
              onClick={handleSubmitComment}
              disabled={!comment.trim() || submittingComment}
              className="shrink-0"
            >
              등록
            </Button>
          </div>

          {/* 멤버 투표 목록 */}
          {votes.length > 0 && (
            <div className="space-y-2">
              {votes.map((vote) => (
                <div
                  key={vote.id}
                  className="flex items-start gap-2 text-sm"
                >
                  <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium shrink-0">
                    {vote.profile?.display_name?.[0] ?? "?"}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-xs">
                        {vote.profile?.display_name ?? "멤버"}
                      </span>
                      <span className="flex items-center gap-0.5">
                        {Array.from({ length: 5 }, (_, i) => (
                          <Star
                            key={i}
                            className={`w-3 h-3 ${
                              i < vote.vote_type
                                ? "fill-yellow-400 text-yellow-400"
                                : "text-gray-200"
                            }`}
                          />
                        ))}
                      </span>
                    </div>
                    {vote.comment && (
                      <p className="text-muted-foreground text-xs mt-0.5">
                        {vote.comment}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 일정 추가 다이얼로그 */}
      <Dialog open={scheduleDialogOpen} onOpenChange={setScheduleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>일정에 추가</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              "{place.name}"을(를) 어느 날짜에 추가할까요?
            </p>
            <Select
              value={selectedScheduleId}
              onValueChange={(v) => { if (v) setSelectedScheduleId(v); }}
            >
              <SelectTrigger>
                <SelectValue placeholder="날짜 선택" />
              </SelectTrigger>
              <SelectContent>
                {schedules.map((s, idx) => (
                  <SelectItem key={s.id} value={s.id}>
                    Day {idx + 1} (
                    {format(parseISO(s.date), "M/d EEE", { locale: ko })})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setScheduleDialogOpen(false)}
              >
                취소
              </Button>
              <Button
                onClick={handleAddToSchedule}
                disabled={!selectedScheduleId}
              >
                추가
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
