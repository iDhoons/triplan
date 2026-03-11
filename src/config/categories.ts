import type { PlaceCategory } from "@/types/database";

export const PLACE_CATEGORY_LABEL: Record<PlaceCategory | "all", string> = {
  all: "전체",
  accommodation: "숙소",
  attraction: "관광지",
  restaurant: "맛집",
  other: "기타",
};

export const PLACE_CATEGORIES: PlaceCategory[] = [
  "accommodation",
  "attraction",
  "restaurant",
  "other",
];

export const PLACE_CATEGORY_BADGE_CLASS: Record<PlaceCategory, string> = {
  accommodation:
    "bg-cat-accommodation text-cat-accommodation-fg border-cat-accommodation-border",
  attraction:
    "bg-cat-attraction text-cat-attraction-fg border-cat-attraction-border",
  restaurant:
    "bg-cat-restaurant text-cat-restaurant-fg border-cat-restaurant-border",
  other: "bg-cat-other text-cat-other-fg border-cat-other-border",
};
