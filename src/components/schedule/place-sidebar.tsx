"use client";

import { useDraggable } from "@dnd-kit/core";
import { MapPin, Hotel, UtensilsCrossed, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { Place, PlaceCategory } from "@/types/database";

// -----------------------------------------------------------------------
// Category helpers
// -----------------------------------------------------------------------
const CATEGORY_LABEL: Record<PlaceCategory, string> = {
  accommodation: "숙소",
  attraction: "명소",
  restaurant: "식당",
  other: "기타",
};

const CATEGORY_ICON: Record<PlaceCategory, React.ReactNode> = {
  accommodation: <Hotel className="w-3.5 h-3.5" />,
  attraction: <MapPin className="w-3.5 h-3.5" />,
  restaurant: <UtensilsCrossed className="w-3.5 h-3.5" />,
  other: <MapPin className="w-3.5 h-3.5" />,
};

// -----------------------------------------------------------------------
// Single draggable place card
// -----------------------------------------------------------------------
interface PlaceCardProps {
  place: Place;
  isScheduled: boolean;
}

function PlaceCard({ place, isScheduled }: PlaceCardProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `place-${place.id}`,
    data: { type: "place", place },
    disabled: isScheduled,
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn(
        "border rounded-lg p-2.5 select-none transition-all",
        isScheduled
          ? "opacity-40 cursor-not-allowed bg-muted"
          : "bg-card cursor-grab active:cursor-grabbing hover:border-primary/60 hover:shadow-sm",
        isDragging && "opacity-30 ring-2 ring-primary"
      )}
    >
      {/* Place image thumbnail */}
      {place.image_urls?.[0] ? (
        <div className="w-full h-16 rounded mb-2 overflow-hidden bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={place.image_urls[0]}
            alt={place.name}
            className="w-full h-full object-cover"
          />
        </div>
      ) : (
        <div className="w-full h-16 rounded mb-2 bg-muted flex items-center justify-center">
          <MapPin className="w-5 h-5 text-muted-foreground/40" />
        </div>
      )}

      {/* Name */}
      <p className="text-xs font-medium leading-snug line-clamp-2 mb-1">
        {place.name}
      </p>

      {/* Category + rating row */}
      <div className="flex items-center justify-between gap-1">
        <Badge variant="outline" className="text-[10px] h-4 px-1 gap-0.5">
          {CATEGORY_ICON[place.category]}
          {CATEGORY_LABEL[place.category]}
        </Badge>
        {place.rating != null && (
          <div className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
            <Star className="w-2.5 h-2.5 fill-yellow-400 text-yellow-400" />
            {place.rating}
          </div>
        )}
      </div>

      {isScheduled && (
        <p className="text-[10px] text-muted-foreground mt-1">이미 배치됨</p>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------
// Sidebar wrapper
// -----------------------------------------------------------------------
interface PlaceSidebarProps {
  places: Place[];
  scheduledPlaceIds: Set<string>;
}

export function PlaceSidebar({ places, scheduledPlaceIds }: PlaceSidebarProps) {
  if (places.length === 0) {
    return (
      <aside className="flex flex-col h-full">
        <h3 className="text-sm font-semibold mb-3 px-1">수집한 장소</h3>
        <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground text-center px-4">
          수집한 장소가 없습니다.
          <br />
          장소 탭에서 장소를 추가해보세요.
        </div>
      </aside>
    );
  }

  return (
    <aside className="flex flex-col h-full">
      <h3 className="text-sm font-semibold mb-3 px-1">
        수집한 장소{" "}
        <span className="text-muted-foreground font-normal">
          ({places.length})
        </span>
      </h3>
      <p className="text-xs text-muted-foreground mb-3 px-1">
        카드를 날짜로 드래그해서 일정에 추가하세요.
      </p>
      <ScrollArea className="flex-1">
        <div className="grid grid-cols-2 md:grid-cols-1 gap-2 pr-2">
          {places.map((place) => (
            <PlaceCard
              key={place.id}
              place={place}
              isScheduled={scheduledPlaceIds.has(place.id)}
            />
          ))}
        </div>
      </ScrollArea>
    </aside>
  );
}
