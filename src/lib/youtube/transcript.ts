import "server-only";

import { YoutubeTranscript } from "youtube-transcript";

// ── 타입 ──

export interface TranscriptSegment {
  text: string;
  offset: number; // ms
  duration: number; // ms
}

export interface TranscriptResult {
  segments: TranscriptSegment[];
  source: "transcript" | "description";
  language: string;
  videoTitle: string;
  videoId: string;
}

// ── URL 파싱 ──

const YOUTUBE_HOSTS = ["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"];

export function isYouTubeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return YOUTUBE_HOSTS.includes(parsed.hostname);
  } catch {
    return false;
  }
}

export function extractVideoId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname;

    if (!YOUTUBE_HOSTS.includes(host)) return null;

    // youtu.be/VIDEO_ID
    if (host === "youtu.be") {
      return parsed.pathname.slice(1) || null;
    }

    // /watch?v=VIDEO_ID
    const vParam = parsed.searchParams.get("v");
    if (vParam) return vParam;

    // /shorts/VIDEO_ID or /embed/VIDEO_ID
    const match = parsed.pathname.match(/^\/(shorts|embed)\/([a-zA-Z0-9_-]+)/);
    if (match) return match[2];

    return null;
  } catch {
    return null;
  }
}

export function isShortsUrl(url: string): boolean {
  try {
    return new URL(url).pathname.startsWith("/shorts/");
  } catch {
    return false;
  }
}

// ── 자막 추출 ──

const LANGUAGE_FALLBACK = ["ko", "en", "ja"];
const MAX_CHARS = 15_000;

export async function fetchTranscript(videoId: string): Promise<TranscriptResult> {
  // 제목을 한 번만 가져온다
  const videoTitle = await fetchVideoTitle(videoId);

  // 1. 언어별 시도
  for (const lang of LANGUAGE_FALLBACK) {
    try {
      const segments = await YoutubeTranscript.fetchTranscript(videoId, { lang });
      if (segments.length > 0) {
        return {
          segments: segments.map((s) => ({
            text: s.text,
            offset: s.offset,
            duration: s.duration,
          })),
          source: "transcript",
          language: lang,
          videoTitle,
          videoId,
        };
      }
    } catch {
      // 다음 언어로 폴백
    }
  }

  // 2. 언어 지정 없이 시도 (자동 생성 자막 등)
  try {
    const segments = await YoutubeTranscript.fetchTranscript(videoId);
    if (segments.length > 0) {
      return {
        segments: segments.map((s) => ({
          text: s.text,
          offset: s.offset,
          duration: s.duration,
        })),
        source: "transcript",
        language: "auto",
        videoTitle,
        videoId,
      };
    }
  } catch {
    // description 폴백으로
  }

  // 3. Description 폴백
  return {
    segments: [{ text: videoTitle, offset: 0, duration: 0 }],
    source: "description",
    language: "unknown",
    videoTitle,
    videoId,
  };
}

async function fetchVideoTitle(videoId: string): Promise<string> {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return "";
    const data = await res.json();
    return data.title ?? "";
  } catch {
    return "";
  }
}

// ── AI용 포맷 ──

export function formatTranscriptForAI(segments: TranscriptSegment[]): string {
  if (segments.length === 0) return "";

  const totalDuration = segments[segments.length - 1].offset + segments[segments.length - 1].duration;
  const isLong = totalDuration > 3600_000; // 1시간 초과

  let selected = segments;

  // 긴 영상: 단일 패스 버킷팅으로 균등 분할 샘플링
  if (isLong && segments.length > 100) {
    const numSections = 12;
    const sectionDuration = totalDuration / numSections;
    const takePerSection = Math.max(1, Math.floor(segments.length / numSections / 3));
    const sampled: TranscriptSegment[] = [];
    const sectionCounts = new Array(numSections).fill(0);

    for (const s of segments) {
      const sectionIdx = Math.min(
        Math.floor(s.offset / sectionDuration),
        numSections - 1
      );
      if (sectionCounts[sectionIdx] < takePerSection) {
        sampled.push(s);
        sectionCounts[sectionIdx]++;
      }
    }

    selected = sampled;
  }

  // 타임스탬프 + 텍스트 포맷
  const lines = selected.map((s) => {
    const totalSec = Math.floor(s.offset / 1000);
    const min = String(Math.floor(totalSec / 60)).padStart(2, "0");
    const sec = String(totalSec % 60).padStart(2, "0");
    return `[${min}:${sec}] ${s.text}`;
  });

  const joined = lines.join("\n");

  // 최대 글자 수 제한
  if (joined.length > MAX_CHARS) {
    return joined.slice(0, MAX_CHARS) + "\n... (이하 생략)";
  }

  return joined;
}
