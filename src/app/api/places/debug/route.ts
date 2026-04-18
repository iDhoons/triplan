import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * GET /api/places/debug?tripId=xxx
 * 장소 데이터 상태 확인용 (개발 전용, 인증 불필요)
 */
export async function GET(request: Request) {
  // 개발 환경에서만 허용
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  const tripId = new URL(request.url).searchParams.get("tripId");

  if (!tripId) {
    return NextResponse.json({ error: "tripId required" }, { status: 400 });
  }

  // Service role로 직접 접근 (개발용)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { data: places } = await supabase
    .from("places")
    .select("id, name, google_place_id, image_urls")
    .eq("trip_id", tripId);

  const summary = (places ?? []).map((p) => ({
    name: p.name,
    hasGoogleId: !!p.google_place_id,
    imageCount: p.image_urls?.length ?? 0,
    firstImage: p.image_urls?.[0]?.slice(0, 100) ?? null,
  }));

  return NextResponse.json({
    total: places?.length ?? 0,
    places: summary,
  });
}
