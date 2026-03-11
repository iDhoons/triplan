import { NextResponse } from "next/server";
import { checkRateLimit, withAuth } from "@/lib/api/guards";
import {
  isYouTubeUrl,
  isShortsUrl,
  extractVideoId,
  fetchTranscript,
  formatTranscriptForAI,
  extractPlacesFromTranscript,
} from "@/lib/youtube";

/**
 * POST /api/youtube/extract-places
 * YouTube URL → 자막 추출 → AI 장소 파싱 (Places API 미호출)
 */
export const POST = withAuth(async (request, { supabase, user }) => {
  // 1. 버스트 방지 (in-memory)
  if (!checkRateLimit("youtube-burst", user.id, { windowMs: 60_000, maxRequests: 3 })) {
    return NextResponse.json(
      { error: "분석 요청이 너무 많습니다. 잠시 후 다시 시도해주세요." },
      { status: 429 }
    );
  }

  // 2. DB 기반 Rate Limit (분/시/일 — 병렬 조회)
  const rateLimitError = await checkDbRateLimit(supabase, user.id);
  if (rateLimitError) {
    return NextResponse.json({ error: rateLimitError }, { status: 429 });
  }

  // 3. 입력 파싱
  let body: { url?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const url = body.url;
  if (typeof url !== "string" || !url.trim()) {
    return NextResponse.json({ error: "url이 필요합니다" }, { status: 400 });
  }

  // 4. URL 검증
  if (!isYouTubeUrl(url)) {
    return NextResponse.json(
      { error: "YouTube URL만 지원합니다 (youtube.com, youtu.be)" },
      { status: 400 }
    );
  }

  const videoId = extractVideoId(url);
  if (!videoId) {
    return NextResponse.json(
      { error: "유효한 YouTube 영상 URL이 아닙니다" },
      { status: 400 }
    );
  }

  const isShorts = isShortsUrl(url);

  try {
    // 5. 자막 추출
    const transcript = await fetchTranscript(videoId);

    if (
      transcript.source === "description" &&
      transcript.segments.length === 1 &&
      !transcript.segments[0].text
    ) {
      return NextResponse.json(
        {
          error:
            "이 영상에는 자막이 없어 장소를 추출할 수 없습니다. 자막이 있는 영상을 사용해주세요.",
        },
        { status: 422 }
      );
    }

    // 6. AI 분석
    const formattedText = formatTranscriptForAI(transcript.segments);
    const places = await extractPlacesFromTranscript(
      formattedText,
      transcript.videoTitle,
      transcript.source
    );

    // 7. activity_logs 기록 (fire-and-forget — 응답 지연 방지)
    supabase.from("activity_logs").insert({
      user_id: user.id,
      action: "youtube_analyze",
      target_type: "youtube",
      target_id: videoId,
      metadata: {
        video_title: transcript.videoTitle,
        source: transcript.source,
        language: transcript.language,
        places_count: places.length,
      },
    }).then(({ error }) => {
      if (error) console.error("[youtube] Activity log error:", error);
    });

    // 8. 응답
    return NextResponse.json({
      videoTitle: transcript.videoTitle,
      source: transcript.source,
      language: transcript.language,
      isShorts,
      places,
    });
  } catch (err) {
    console.error("[youtube/extract-places] Error:", err);
    return NextResponse.json(
      { error: "분석 중 오류가 발생했습니다. 다시 시도해주세요." },
      { status: 500 }
    );
  }
});

// ── DB 기반 Rate Limit (3개 쿼리 병렬) ──

const RATE_LIMITS = [
  { intervalMs: 60_000, max: 3, message: "분석 요청이 너무 많습니다. 1분 후 다시 시도해주세요." },
  { intervalMs: 3600_000, max: 15, message: "시간당 분석 한도에 도달했습니다. 잠시 후 다시 시도해주세요." },
  { intervalMs: 86400_000, max: 50, message: "일일 분석 한도에 도달했습니다. 내일 다시 시도해주세요." },
] as const;

async function checkDbRateLimit(
  supabase: Parameters<Parameters<typeof withAuth>[0]>[1]["supabase"],
  userId: string
): Promise<string | null> {
  const results = await Promise.all(
    RATE_LIMITS.map(async ({ intervalMs, max, message }) => {
      const { count } = await supabase
        .from("activity_logs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("action", "youtube_analyze")
        .gte("created_at", new Date(Date.now() - intervalMs).toISOString());

      return (count ?? 0) >= max ? message : null;
    })
  );

  return results.find((msg) => msg !== null) ?? null;
}
