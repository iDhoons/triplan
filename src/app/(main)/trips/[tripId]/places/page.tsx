"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  MapPinIcon,
  PlusIcon,
  StarIcon,
  SlidersHorizontalIcon,
  ListIcon,
  Map,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { createClient } from "@/lib/supabase/client";
import { PlaceForm } from "@/components/places/place-form";
import { PlaceMap } from "@/components/maps/place-map";
import { cn } from "@/lib/utils";
import type { Place, PlaceCategory } from "@/types/database";

const CATEGORY_LABEL: Record<PlaceCategory | "all", string> = {
  all: "전체",
  accommodation: "숙소",
  attraction: "관광지",
  restaurant: "맛집",
  other: "기타",
};

const CATEGORY_BADGE_CLASS: Record<PlaceCategory, string> = {
  accommodation:
    "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300",
  attraction:
    "bg-green-100 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300",
  restaurant:
    "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300",
  other:
    "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300",
};

type TabValue = PlaceCategory | "all";
const TAB_VALUES: TabValue[] = ["all", "accommodation", "attraction", "restaurant", "other"];

type ViewMode = "list" | "map";

interface PlaceCardProps {
  place: Place;
  selected: boolean;
  compareMode: boolean;
  onToggleSelect: (id: string) => void;
  onEdit: (place: Place) => void;
  onDelete: (place: Place) => void;
}

function PlaceCard({
  place,
  selected,
  compareMode,
  onToggleSelect,
  onEdit,
  onDelete,
}: PlaceCardProps) {
  return (
    <Card
      className={cn(
        "relative cursor-default transition-shadow hover:shadow-md",
        selected && "ring-2 ring-primary"
      )}
    >
      {/* 이미지 */}
      {place.image_urls?.length > 0 && (
        <img
          src={place.image_urls[0]}
          alt={place.name}
          className="h-40 w-full object-cover"
        />
      )}

      <CardHeader className="pb-1">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="line-clamp-1">{place.name}</CardTitle>
          <Badge
            className={cn(
              "shrink-0 border",
              CATEGORY_BADGE_CLASS[place.category]
            )}
            variant="outline"
          >
            {CATEGORY_LABEL[place.category]}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-2">
        {/* 주소 */}
        {place.address && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPinIcon className="size-3 shrink-0" />
            <span className="line-clamp-1">{place.address}</span>
          </div>
        )}

        {/* 가격 (숙소) */}
        {place.category === "accommodation" &&
          place.price_per_night !== null && (
            <p className="text-sm font-semibold text-primary">
              ₩{place.price_per_night.toLocaleString()} / 박
            </p>
          )}

        {/* 평점 */}
        {place.rating !== null && (
          <div className="flex items-center gap-1">
            <StarIcon className="size-3.5 fill-yellow-400 text-yellow-400" />
            <span className="text-sm font-medium">{place.rating}</span>
          </div>
        )}

        {/* 메모 */}
        {place.memo && (
          <p className="line-clamp-2 text-xs text-muted-foreground">
            {place.memo}
          </p>
        )}

        {/* 액션 */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="xs"
              onClick={() => onEdit(place)}
            >
              수정
            </Button>
            <Button
              variant="ghost"
              size="xs"
              className="text-red-500 hover:text-red-700 hover:bg-red-50"
              onClick={() => onDelete(place)}
            >
              삭제
            </Button>
          </div>
          {compareMode && (
            <button
              type="button"
              onClick={() => onToggleSelect(place.id)}
              className={cn(
                "flex h-5 w-5 items-center justify-center rounded border-2 transition-colors",
                selected
                  ? "border-primary bg-primary text-primary-foreground"
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
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function PlacesPage() {
  const { tripId } = useParams<{ tripId: string }>();
  const router = useRouter();
  const supabase = createClient();

  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabValue>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlace, setEditingPlace] = useState<Place | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchPlaces();
  }, [tripId]);

  async function fetchPlaces() {
    setLoading(true);
    const { data } = await supabase
      .from("places")
      .select("*")
      .eq("trip_id", tripId)
      .order("created_at", { ascending: false });
    setPlaces((data as Place[]) ?? []);
    setLoading(false);
  }

  async function handleDelete(place: Place) {
    if (!confirm(`"${place.name}"을(를) 삭제하시겠습니까?`)) return;
    const { error } = await supabase.from("places").delete().eq("id", place.id);
    if (!error) {
      setPlaces((prev) => prev.filter((p) => p.id !== place.id));
    }
  }

  function handleFormSuccess(place: Place) {
    setPlaces((prev) => {
      const idx = prev.findIndex((p) => p.id === place.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = place;
        return next;
      }
      return [place, ...prev];
    });
    setDialogOpen(false);
    setEditingPlace(null);
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < 4) {
        next.add(id);
      }
      return next;
    });
  }

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
              size="sm"
              className="h-7 px-2.5 text-xs gap-1"
              onClick={() => setViewMode("list")}
            >
              <ListIcon className="size-3.5" />
              목록
            </Button>
            <Button
              variant={viewMode === "map" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 px-2.5 text-xs gap-1"
              onClick={() => setViewMode("map")}
            >
              <Map className="size-3.5" />
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
          <Dialog
            open={dialogOpen}
            onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) setEditingPlace(null);
            }}
          >
            <DialogTrigger
              render={
                <Button size="sm">
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
            size="sm"
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
              {CATEGORY_LABEL[tab]}
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
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[...Array(4)].map((_, i) => (
                  <div
                    key={i}
                    className="h-48 animate-pulse rounded-xl bg-muted"
                  />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
                <MapPinIcon className="size-10 opacity-30" />
                <p className="text-sm">아직 등록된 장소가 없어요</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDialogOpen(true)}
                >
                  <PlusIcon className="size-3.5" />
                  장소 추가하기
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((place) => (
                  <PlaceCard
                    key={place.id}
                    place={place}
                    selected={selectedIds.has(place.id)}
                    compareMode={compareMode}
                    onToggleSelect={toggleSelect}
                    onEdit={(p) => {
                      setEditingPlace(p);
                      setDialogOpen(true);
                    }}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
