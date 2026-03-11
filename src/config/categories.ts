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
