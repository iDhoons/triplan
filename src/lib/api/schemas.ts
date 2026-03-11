import { z } from "zod";

export const aiRecommendSchema = z.object({
  trip_id: z.string().min(1),
  message: z.string().min(1).max(2000),
  type: z
    .enum(["recommend", "generate-schedule", "route-check", "fill-empty"])
    .optional(),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(4000),
      })
    )
    .max(50)
    .optional(),
});

export const placeShareSchema = z.object({
  url: z.string().url().max(2048),
  trip_id: z.string().min(1),
});

export const scrapeSchema = z.object({
  url: z.string().url().max(2048),
  trip_id: z.string().min(1),
});
