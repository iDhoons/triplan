"use client";

import { memo, useState, useCallback, useRef, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  MapPinIcon,
  PlusIcon,
  StarIcon,
  SlidersHorizontalIcon,
  ListIcon,
  Map as MapIcon,
  YoutubeIcon,
  MoreHorizontalIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createClient } from "@/lib/supabase/client";
import { PlaceImage } from "@/components/ui/place-image";
import { PlaceForm } from "@/components/places/place-form";
import { PlaceDetailDrawer } from "@/components/places/place-detail-drawer";
import { YouTubePlacePicker } from "@/components/places/youtube-place-picker";
import dynamic from "next/dynamic";

const PlaceMap = dynamic(
  () => import("@/components/maps/place-map").then((mod) => mod.PlaceMap),
  {
    loading: () => (
      <div className="h-[500px] w-full rounded-lg bg-muted animate-pulse flex items-center justify-center">
        <MapIcon className="size-8 text-muted-foreground/40" />
      </div>
    ),
    ssr: false,
  }
);
import { usePlaces } from "@/hooks/use-places";
import { queryKeys } from "@/hooks/query-keys";
import { PlaceCardSkeleton } from "@/components/layout/loading-skeleton";
import { cn, formatShortAddress, isLegacyGooglePhotoUrl } from "@/lib/utils";
import { PLACE_CATEGORY_LABEL, PLACE_CATEGORY_BADGE_CLASS } from "@/config/categories";
import type { Place, PlaceCategory } from "@/types/database";

type IdleHandle = number;

type TabValue = PlaceCategory | "all";
const TAB_VALUES: TabValue[] = ["all", "accommodation", "attraction", "restaurant", "other"];

type ViewMode = "list" | "map";

function scheduleBackgroundWork(task: () => void): { cancel: () => void } {
  const browserWindow = typeof window !== "undefined" ? window : null;

  if (!browserWindow) {
    return { cancel: () => undefined };
  }

  if ("requestIdleCallback" in browserWindow) {
    const handle = (
      browserWindow as Window & {
        requestIdleCallback: (
          callback: IdleRequestCallback,
          options?: IdleRequestOptions
        ) => IdleHandle;
        cancelIdleCallback: (id: IdleHandle) => void;
      }
    ).requestIdleCallback(() => task(), { timeout: 2000 });

    return {
      cancel: () =>
        (
          browserWindow as Window & {
            cancelIdleCallback: (id: IdleHandle) => void;
          }
        ).cancelIdleCallback(handle),
    };
  }

  const handle = globalThis.setTimeout(task, 1200);
  return {
    cancel: () => globalThis.clearTimeout(handle),
  };
}

function getPhotoRepairConcurrency(): number {
  if (typeof navigator === "undefined") return 3;

  const connection = (
    navigator as Navigator & {
      connection?: {
        saveData?: boolean;
        effectiveType?: string;
      };
    }
  ).connection;

  if (!connection) return 3;
  if (connection.saveData) return 1;
  if (connection.effectiveType === "slow-2g" || connection.effectiveType === "2g") {
    return 1;
  }
  if (connection.effectiveType === "3g") return 2;
  return 3;
}

interface PlaceCardProps {
  place: Place;
  selected: boolean;
  compareMode: boolean;
  onToggleSelect: (id: string) => void;
  onEdit: (place: Place) => void;
  onDelete: (place: Place) => void;
  onOpenDetail: (place: Place) => void;
}

const PlaceCard = memo(function PlaceCard({
  place,
  selected,
  compareMode,
  onToggleSelect,
  onEdit,
  onDelete,
  onOpenDetail,
}: PlaceCardProps) {
  const shortAddress = formatShortAddress(place.address_components, place.address);
  const hasImage = place.image_urls?.length > 0;

  return (
    <Card
      variant="plain"
      className={cn(
        "relative cursor-pointer overflow-hidden group border-0",
        "h-44 sm:h-52 transition-all hover:shadow-lg",
        selected && "ring-2 ring-primary"
      )}
      onClick={() => onOpenDetail(place)}
    >
      {/* 배경 이미지 (전체 카드) */}
      <PlaceImage
        src={hasImage ? place.image_urls[0] : undefined}
        alt={place.name}
        width={400}
        className={cn(
          hasImage
            ? "absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            : "absolute inset-0 h-full w-full",
          !hasImage && place.category === "accommodation" && "bg-cat-accommodation/20",
          !hasImage && place.category === "attraction" && "bg-cat-attraction/20",
          !hasImage && place.category === "restaurant" && "bg-cat-restaurant/20",
          !hasImage && place.category === "other" && "bg-muted",
        )}
        fallbackIcon={<MapPinIcon className="size-8 text-muted-foreground/30" />}
      />

      {/* 그라디언트 오버레이 — ease-in 곡선 다중 stop으로 검정 띠 방지 */}
      {hasImage && (
        <div
          className="absolute inset-0 z-[1]"
          style={{
            background:
              "linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 28%, rgba(0,0,0,0.6) 45%, rgba(0,0,0,0.25) 60%, rgba(0,0,0,0.05) 72%, transparent 80%)",
          }}
        />
      )}

      {/* 상단 — 카테고리 뱃지 + 더보기 */}
      <div className="absolute top-2 left-2 right-2 flex items-center justify-between z-10">
        <Badge
          className={cn(
            "shrink-0 text-[10px] px-1.5 py-0",
            hasImage
              ? "bg-black/40 text-white border-white/20 backdrop-blur-sm"
              : cn("border", PLACE_CATEGORY_BADGE_CLASS[place.category])
          )}
          variant="outline"
        >
          {PLACE_CATEGORY_LABEL[place.category]}
        </Badge>
        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="xs"
                  className={cn(
                    "size-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity",
                    hasImage
                      ? "text-white/80 hover:text-white hover:bg-white/20"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <MoreHorizontalIcon className="size-3.5" />
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(place)}>
                수정
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-red-600"
                onClick={() => onDelete(place)}
              >
                삭제
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* 하단 — 장소 정보 오버레이 */}
      <div className={cn(
        "absolute inset-x-0 bottom-0 p-3 flex flex-col gap-0.5 z-10",
        hasImage ? "text-white" : "text-foreground"
      )}>
        <h3 className="text-sm font-semibold line-clamp-1 drop-shadow-sm">
          {place.name}
        </h3>

        {shortAddress && (
          <p className={cn(
            "flex items-center gap-1 text-xs",
            hasImage ? "text-white/70" : "text-muted-foreground"
          )}>
            <MapPinIcon className="size-3 shrink-0" />
            <span className="truncate">{shortAddress}</span>
          </p>
        )}

        {place.rating !== null && (
          <div className="flex items-center gap-0.5">
            <StarIcon className="size-3 fill-yellow-400 text-yellow-400" />
            <span className={cn(
              "text-xs font-medium",
              hasImage ? "text-white" : "text-foreground"
            )}>
              {place.rating}
            </span>
            {place.review_count !== null && (
              <span className={cn(
                "text-xs",
                hasImage ? "text-white/60" : "text-muted-foreground"
              )}>
                ({place.review_count.toLocaleString()})
              </span>
            )}
          </div>
        )}

        {/* 카테고리별 보조 정보 */}
        {place.category === "accommodation" && place.price_per_night !== null && (
          <p className={cn("text-xs", hasImage ? "text-white/70" : "text-muted-foreground")}>
            ₩{place.price_per_night.toLocaleString()} / 박
          </p>
        )}
        {place.category === "attraction" && (place.estimated_duration !== null || place.admission_fee !== null) && (
          <p className={cn("text-xs", hasImage ? "text-white/70" : "text-muted-foreground")}>
            {[
              place.estimated_duration !== null && `${place.estimated_duration}분`,
              place.admission_fee !== null && (place.admission_fee === 0 ? "무료" : `₩${place.admission_fee.toLocaleString()}`),
            ].filter(Boolean).join(" · ")}
          </p>
        )}
        {place.category === "restaurant" && place.price_level !== null && (
          <p className={cn("text-xs", hasImage ? "text-white/70" : "text-muted-foreground")}>
            {"₩".repeat(Math.min(place.price_level, 4)) || "무료"}
          </p>
        )}

        {/* 비교 모드 체크박스 */}
        {compareMode && (
          <div className="flex justify-end pt-0.5" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => onToggleSelect(place.id)}
              className={cn(
                "flex h-5 w-5 items-center justify-center rounded border-2 transition-colors",
                selected
                  ? "border-primary bg-primary text-primary-foreground"
                  : hasImage
                    ? "border-white/60"
                    : "border-muted-foreground"
              )}
              aria-label={selected ? "선택 해제" : "선택"}
            >
              {selected && (
                <svg
                  viewBox="0 0 12 12"
                  fill="none"
                  className="size-3"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polyline points="1.5,6 4.5,9 10.5,3" />
                </svg>
              )}
            </button>
          </div>
        )}
      </div>
    </Card>
  );
});

export default function PlacesPage() {
  const { tripId } = useParams<{ tripId: string }>();
  const router = useRouter();
  const supabase = createClient();
  const queryClient = useQueryClient();

  const { data: places = [], isLoading: loading, isError, error: queryError } = usePlaces(tripId);

  // 사진 없는 장소 자동 보충 — google_place_id가 있지만 image_urls가 비어있으면 resolve
  const photoFixAttempted = useRef(false);
  useEffect(() => {
    if (!places.length || photoFixAttempted.current) return;

    const needPhotos = places.filter((p) => {
      if (!p.image_urls || p.image_urls.length === 0) return true;
      return p.image_urls.some((url) => isLegacyGooglePhotoUrl(url));
    });
    if (needPhotos.length === 0) return;

    photoFixAttempted.current = true;
    let cancelled = false;
    const backgroundTask = scheduleBackgroundWork(() => {
      void (async () => {
        const concurrency = getPhotoRepairConcurrency();
        const updates = new Map<string, string[]>();

        for (let i = 0; i < needPhotos.length && !cancelled; i += concurrency) {
          const chunk = needPhotos.slice(i, i + concurrency);
          const results = await Promise.allSettled(
            chunk.map(async (place) => {
              const query = [place.name, place.address].filter(Boolean).join(" ");
              const res = await fetch(
                `/api/places/resolve-photos?${new URLSearchParams({
                  ...(place.google_place_id ? { googlePlaceId: place.google_place_id } : {}),
                  ...(query ? { query } : {}),
                }).toString()}`
              );
              if (!res.ok) return null;
              const { urls } = await res.json();
              if (!urls?.length) return null;

              const { error } = await supabase
                .from("places")
                .update({ image_urls: urls })
                .eq("id", place.id);

              if (error) return null;
              return { placeId: place.id, urls };
            })
          );

          for (const result of results) {
            if (result.status === "fulfilled" && result.value) {
              updates.set(result.value.placeId, result.value.urls);
            }
          }

          // Yield between chunks so scrolling and taps stay responsive.
          if (i + concurrency < needPhotos.length) {
            await new Promise((resolve) => window.setTimeout(resolve, 150));
          }
        }

        if (cancelled || updates.size === 0) return;

        queryClient.setQueryData<Place[]>(
          queryKeys.places.byTrip(tripId),
          (current = []) =>
            current.map((place) =>
              updates.has(place.id)
                ? { ...place, image_urls: updates.get(place.id)! }
                : place
            )
        );
      })();
    });

    return () => {
      cancelled = true;
      backgroundTask.cancel();
    };
  }, [places, supabase, queryClient, tripId]);

  const [activeTab, setActiveTab] = useState<TabValue>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlace, setEditingPlace] = useState<Place | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [youtubePickerOpen, setYoutubePickerOpen] = useState(false);

  const handleDelete = useCallback(async (place: Place) => {
    const { error } = await supabase.from("places").delete().eq("id", place.id);
    if (error) {
      toast.error("삭제에 실패했습니다.");
      return;
    }
    queryClient.invalidateQueries({ queryKey: queryKeys.places.byTrip(tripId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.schedules.data(tripId) });
    toast("장소가 삭제되었어요", {
      action: {
        label: "되돌리기",
        onClick: async () => {
          await supabase.from("places").insert({
            id: place.id,
            trip_id: tripId,
            name: place.name,
            category: place.category,
            address: place.address,
            latitude: place.latitude,
            longitude: place.longitude,
            rating: place.rating,
            image_urls: place.image_urls,
            url: place.url,
            source_url: place.source_url,
            memo: place.memo,
            added_by: place.added_by,
            enriched: place.enriched,
            google_place_id: place.google_place_id,
          });
          queryClient.invalidateQueries({ queryKey: queryKeys.places.byTrip(tripId) });
          queryClient.invalidateQueries({ queryKey: queryKeys.schedules.data(tripId) });
          toast.success("장소가 복원되었어요");
        },
      },
      duration: 5000,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId]);

  const handleFormSuccess = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.places.byTrip(tripId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.schedules.data(tripId) });
    setDialogOpen(false);
    setEditingPlace(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < 4) {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleEdit = useCallback((p: Place) => {
    setEditingPlace(p);
    setDialogOpen(true);
  }, []);

  const handleOpenDetail = useCallback((p: Place) => {
    setSelectedPlace(p);
  }, []);

  function goCompare() {
    if (selectedIds.size < 2) return;
    router.push(
      `/trips/${tripId}/places/compare?ids=${Array.from(selectedIds).join(",")}`
    );
  }

  const filtered =
    activeTab === "all"
      ? places
      : places.filter((p) => p.category === activeTab);

  if (isError) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-center">
        <p className="text-sm text-destructive">장소 목록을 불러오지 못했습니다</p>
        <p className="text-xs text-muted-foreground">{queryError?.message}</p>
        <Button size="sm" variant="outline" onClick={() => window.location.reload()}>
          새로고침
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 상단 액션 바 */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">장소 목록</h2>
        <div className="flex items-center gap-2">
          {/* 목록 / 지도 뷰 토글 */}
          <div className="flex rounded-lg border p-0.5 gap-0.5">
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="xs"
              onClick={() => setViewMode("list")}
            >
              <ListIcon className="size-3.5" />
              목록
            </Button>
            <Button
              variant={viewMode === "map" ? "secondary" : "ghost"}
              size="xs"
              onClick={() => setViewMode("map")}
            >
              <MapIcon className="size-3.5" />
              지도
            </Button>
          </div>
          <Button
            variant={compareMode ? "secondary" : "outline"}
            size="sm"
            onClick={() => {
              setCompareMode((v) => !v);
              setSelectedIds(new Set());
            }}
          >
            <SlidersHorizontalIcon className="size-3.5" />
            비교하기
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setYoutubePickerOpen(true)}
          >
            <YoutubeIcon className="size-3.5 text-red-500" />
            YouTube
          </Button>

          <Dialog
            open={dialogOpen}
            onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) setEditingPlace(null);
            }}
          >
            <DialogTrigger
              render={
                <Button>
                  <PlusIcon className="size-3.5" />
                  장소 추가
                </Button>
              }
            />
            <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>
                  {editingPlace ? "장소 수정" : "장소 추가"}
                </DialogTitle>
              </DialogHeader>
              <PlaceForm
                tripId={tripId}
                place={editingPlace ?? undefined}
                onSuccess={handleFormSuccess}
                onCancel={() => {
                  setDialogOpen(false);
                  setEditingPlace(null);
                }}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* 비교 모드 배너 */}
      {compareMode && (
        <div className="flex items-center justify-between rounded-lg bg-primary/10 px-3 py-2 text-sm">
          <span>
            {selectedIds.size === 0
              ? "카드를 2~4개 선택하세요"
              : `${selectedIds.size}개 선택됨 (최대 4개)`}
          </span>
          <Button
            disabled={selectedIds.size < 2}
            onClick={goCompare}
          >
            비교 시작
          </Button>
        </div>
      )}

      {/* 지도 뷰 */}
      {viewMode === "map" && (
        <PlaceMap
          places={
            activeTab === "all"
              ? places
              : places.filter((p) => p.category === activeTab)
          }
          className="h-[500px]"
        />
      )}

      {/* 카테고리 탭 */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as TabValue)}
      >
        <TabsList variant="line" className="w-full justify-start overflow-x-auto">
          {TAB_VALUES.map((tab) => (
            <TabsTrigger key={tab} value={tab}>
              {PLACE_CATEGORY_LABEL[tab]}
              {tab !== "all" && (
                <span className="ml-1 text-xs text-muted-foreground">
                  ({places.filter((p) => p.category === tab).length})
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        {TAB_VALUES.map((tab) => (
          <TabsContent key={tab} value={tab} className={cn("mt-4", viewMode === "map" && "hidden")}>
            {loading ? (
              <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
                {[...Array(4)].map((_, i) => (
                  <PlaceCardSkeleton key={i} />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center gap-4 py-20 text-center animate-fade-in-up">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                  <MapPinIcon className="h-8 w-8 text-primary/60" />
                </div>
                <div className="space-y-1">
                  <p className="font-medium text-foreground/80">아직 등록된 장소가 없어요</p>
                  <p className="text-sm text-muted-foreground">가보고 싶은 장소를 추가해보세요!</p>
                </div>
                <div className="flex gap-2 mt-1">
                  <Button
                    variant="outline"
                    onClick={() => setDialogOpen(true)}
                  >
                    <PlusIcon className="size-3.5" />
                    장소 추가하기
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setYoutubePickerOpen(true)}
                  >
                    <YoutubeIcon className="size-3.5 text-red-500" />
                    YouTube에서 가져오기
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 animate-stagger">
                {filtered.map((place) => (
                  <PlaceCard
                    key={place.id}
                    place={place}
                    selected={selectedIds.has(place.id)}
                    compareMode={compareMode}
                    onToggleSelect={toggleSelect}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onOpenDetail={handleOpenDetail}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* YouTube 장소 가져오기 */}
      <YouTubePlacePicker
        tripId={tripId}
        open={youtubePickerOpen}
        onOpenChange={setYoutubePickerOpen}
      />

      {/* 장소 상세 Drawer */}
      <PlaceDetailDrawer
        place={selectedPlace}
        onOpenChange={(open) => {
          if (!open) setSelectedPlace(null);
        }}
        onEdit={(p) => {
          setEditingPlace(p);
          setDialogOpen(true);
        }}
        onDelete={handleDelete}
      />
    </div>
  );
}
