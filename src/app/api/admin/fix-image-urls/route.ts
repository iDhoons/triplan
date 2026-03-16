import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/guards";
import { textSearch, getPhotoUrl } from "@/lib/google-places/client";

/**
 * POST /api/admin/fix-image-urls
 * 만료된 Google CDN URL을 서버 프록시 URL로 일괄 교체.
 * 일회성 마이그레이션용 — 수정 완료 후 삭제 가능.
 */
export const POST = withAuth(async (_request, { supabase }) => {
  // 프록시 URL이 아닌 image_urls를 가진 장소 조회
  const { data: places, error: queryErr } = await supabase
    .from("places")
    .select("id, name, google_place_id, image_urls")
    .not("image_urls", "eq", "{}");

  if (queryErr) {
    return NextResponse.json({ error: queryErr.message }, { status: 500 });
  }

  // 프록시 URL(/api/places/photo)이 아닌 장소만 필터
  const broken = (places ?? []).filter((p) => {
    const urls: string[] = p.image_urls ?? [];
    return urls.length > 0 && !urls[0].startsWith("/api/");
  });

  if (broken.length === 0) {
    return NextResponse.json({ message: "수정할 장소가 없습니다", fixed: 0 });
  }

  const results: { id: string; name: string; status: string }[] = [];

  for (const place of broken) {
    try {
      // 장소명으로 서버 Places API 검색
      const searchResults = await textSearch(place.name, { maxResultCount: 1 });

      if (searchResults.length === 0 || !searchResults[0].photos?.length) {
        results.push({ id: place.id, name: place.name, status: "no_results" });
        continue;
      }

      const found = searchResults[0];

      // 프록시 URL 생성 (최대 5장)
      const proxyUrls = found.photos!
        .slice(0, 5)
        .map((p) => getPhotoUrl(p.name));

      // DB 업데이트: image_urls + google_place_id
      const updatePayload: Record<string, unknown> = {
        image_urls: proxyUrls,
      };

      // google_place_id가 없으면 함께 설정
      if (!place.google_place_id && found.id) {
        updatePayload.google_place_id = found.id;
      }

      const { error: updateErr } = await supabase
        .from("places")
        .update(updatePayload)
        .eq("id", place.id);

      if (updateErr) {
        results.push({ id: place.id, name: place.name, status: `error: ${updateErr.message}` });
      } else {
        results.push({ id: place.id, name: place.name, status: "fixed" });
      }
    } catch (err) {
      results.push({
        id: place.id,
        name: place.name,
        status: `error: ${err instanceof Error ? err.message : "unknown"}`,
      });
    }
  }

  const fixed = results.filter((r) => r.status === "fixed").length;
  return NextResponse.json({ fixed, total: broken.length, results });
});
