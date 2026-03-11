import type { PlaceCategory } from "./database";

export interface ExtractedPlace {
  name: string;
  category: PlaceCategory;
  timestamp: string;
  context: string;
  confidence: "high" | "medium" | "low";
}
