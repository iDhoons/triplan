/**
 * 일회성 마이그레이션: 만료된 Google CDN URL → 서버 프록시 URL 교체
 * 실행: npx tsx scripts/fix-image-urls.mts
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY!;

if (!SUPABASE_URL || !SUPABASE_KEY || !GOOGLE_API_KEY) {
  console.error("Missing env vars. Check .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const API_BASE = "https://places.googleapis.com/v1";

async function textSearch(query: string): Promise<{ id: string; photos?: { name: string }[] } | null> {
  const res = await fetch(`${API_BASE}/places:searchText`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": GOOGLE_API_KEY,
      "X-Goog-FieldMask": "places.id,places.photos",
    },
    body: JSON.stringify({ textQuery: query, languageCode: "ko", maxResultCount: 1 }),
  });
  if (!res.ok) {
    console.error(`  Places API error: ${res.status} ${await res.text()}`);
    return null;
  }
  const data = await res.json();
  return data.places?.[0] ?? null;
}

function getPhotoProxyUrl(photoName: string, maxWidth = 800): string {
  return `/api/places/photo?name=${encodeURIComponent(photoName)}&maxWidth=${maxWidth}`;
}

async function main() {
  console.log("=== 만료된 이미지 URL 일괄 수정 ===\n");

  // 1. 프록시 URL이 아닌 image_urls를 가진 장소 조회
  const { data: allPlaces, error } = await supabase
    .from("places")
    .select("id, name, google_place_id, image_urls");

  if (error) {
    console.error("DB 조회 실패:", error.message);
    process.exit(1);
  }

  const broken = (allPlaces ?? []).filter((p) => {
    const urls: string[] = p.image_urls ?? [];
    return urls.length > 0 && !urls[0].startsWith("/api/");
  });

  if (broken.length === 0) {
    console.log("수정할 장소가 없습니다.");
    return;
  }

  console.log(`수정 대상: ${broken.length}개\n`);

  let fixed = 0;
  let failed = 0;

  for (const place of broken) {
    process.stdout.write(`[${fixed + failed + 1}/${broken.length}] ${place.name} ... `);

    const result = await textSearch(place.name);
    if (!result?.photos?.length) {
      console.log("SKIP (검색 결과 없음)");
      failed++;
      continue;
    }

    const proxyUrls = result.photos.slice(0, 5).map((p) => getPhotoProxyUrl(p.name));

    const updatePayload: Record<string, unknown> = { image_urls: proxyUrls };
    if (!place.google_place_id && result.id) {
      updatePayload.google_place_id = result.id;
    }

    const { error: updateErr } = await supabase
      .from("places")
      .update(updatePayload)
      .eq("id", place.id);

    if (updateErr) {
      console.log(`FAIL (${updateErr.message})`);
      failed++;
    } else {
      console.log(`OK (${proxyUrls.length}장)`);
      fixed++;
    }
  }

  console.log(`\n=== 완료: ${fixed}개 수정, ${failed}개 실패 ===`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
