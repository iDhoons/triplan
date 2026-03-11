import { NextResponse } from "next/server";
import { withTripMember } from "@/lib/api/guards";
import { enrichSelectedPlaces, checkDuplicates } from "@/lib/youtube";
import { PLACE_CATEGORIES } from "@/config/categories";
import type { ExtractedPlace } from "@/types/youtube";
import type { PlaceCategory } from "@/types/database";

const VALID_CATEGORIES = new Set<string>(PLACE_CATEGORIES);

/**
 * POST /api/youtube/add-places
 * 선택된 장소 → Places API 보강 → 중복 체크 → 일괄 추가
 */
export const POST = withTripMember(
  (_req, body) => (body as { trip_id?: string })?.trip_id ?? null,
  async (_request, { supabase, user, role }) => {
    // viewer 권한 차단
    if (role === "viewer") {
      return NextResponse.json({ error: "장소를 추가할 권한이 없습니다" }, { status: 403 });
    }

    // body는 withTripMember가 이미 파싱했으므로 request.clone() 사용
    let body: { trip_id?: string; places?: unknown };
    try {
      body = await _request.clone().json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const tripId = body.trip_id;
    const rawPlaces = body.places;

    if (typeof tripId !== "string" || !Array.isArray(rawPlaces) || rawPlaces.length === 0) {
      return NextResponse.json(
        { error: "trip_id와 places 배열이 필요합니다" },
        { status: 400 }
      );
    }

    if (rawPlaces.length > 20) {
      return NextResponse.json(
        { error: "한 번에 최대 20개까지 추가할 수 있습니다" },
        { status: 400 }
      );
    }

    // 입력 검증
    const places: ExtractedPlace[] = rawPlaces
      .filter(
        (p: unknown): p is { name: string; category: string; context?: string; confidence?: string; timestamp?: string } =>
          typeof p === "object" &&
          p !== null &&
          typeof (p as Record<string, unknown>).name === "string" &&
          typeof (p as Record<string, unknown>).category === "string" &&
          VALID_CATEGORIES.has((p as Record<string, unknown>).category as string)
      )
      .map((p) => ({
        name: p.name.trim(),
        category: p.category as PlaceCategory,
        context: p.context || "",
        confidence: (p.confidence as "high" | "medium" | "low") || "medium",
        timestamp: p.timestamp || "",
      }));

    if (places.length === 0) {
      return NextResponse.json({ error: "유효한 장소가 없습니다" }, { status: 400 });
    }

    try {
      // Places API 보강
      const enrichedPlaces = await enrichSelectedPlaces(places);

      // 중복 체크
      const { newPlaces, duplicates } = await checkDuplicates(tripId, enrichedPlaces, supabase);

      // 일괄 insert
      const added: { id: string; name: string; enriched: boolean }[] = [];

      if (newPlaces.length > 0) {
        const insertData = newPlaces.map((place) => ({
          trip_id: tripId,
          name: place.name,
          category: place.category,
          address: place.address,
          latitude: place.latitude,
          longitude: place.longitude,
          rating: place.rating,
          image_urls: place.image_urls,
          google_place_id: place.google_place_id,
          phone: place.phone,
          website: place.website,
          review_count: place.review_count,
          description: place.description,
          enriched: place.enriched,
          enriched_at: place.enriched ? new Date().toISOString() : null,
          enrich_attempts: 1,
          enrich_error: place.enriched ? null : "Places API에서 정보를 찾지 못함",
          memo: place.memo,
          opening_hours: place.opening_hours,
          price_level: place.price_level,
          business_status: place.business_status,
          added_by: user.id,
          amenities: [],
          url: null,
        }));

        const { data: insertedRows, error: insertErr } = await supabase
          .from("places")
          .insert(insertData)
          .select("id, name, enriched");

        if (insertErr) {
          console.error("[youtube/add-places] Insert error:", insertErr);
          return NextResponse.json(
            { error: "장소 추가 중 오류가 발생했습니다" },
            { status: 500 }
          );
        }

        if (insertedRows) {
          added.push(...insertedRows);
        }
      }

      return NextResponse.json({
        added,
        skipped: duplicates.map((p) => ({
          name: p.name,
          reason: "이미 추가된 장소입니다",
        })),
      });
    } catch (err) {
      console.error("[youtube/add-places] Error:", err);
      return NextResponse.json(
        { error: "장소 추가 중 오류가 발생했습니다. 다시 시도해주세요." },
        { status: 500 }
      );
    }
  }
);
