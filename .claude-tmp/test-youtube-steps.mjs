/**
 * YouTube 장소 추출 각 단계 개별 테스트
 * 실행: node --env-file=.env.local .claude-tmp/test-youtube-steps.mjs
 */

// Step 1: youtube-transcript 패키지 테스트
console.log("\n=== Step 1: youtube-transcript import 테스트 ===");
let YoutubeTranscript;
try {
  const mod = await import("youtube-transcript");
  YoutubeTranscript = mod.YoutubeTranscript;
  if (YoutubeTranscript) {
    console.log("✅ YoutubeTranscript import 성공");
  } else {
    console.log("❌ YoutubeTranscript가 undefined — exports:", Object.keys(mod));
    process.exit(1);
  }
} catch (e) {
  console.log("❌ import 실패:", e.message);
  // fallback: default export 확인
  try {
    const mod = await import("youtube-transcript");
    console.log("  Available exports:", Object.keys(mod));
  } catch {}
  process.exit(1);
}

// Step 2: 자막 추출 테스트
console.log("\n=== Step 2: 자막 추출 테스트 ===");
const TEST_VIDEO_ID = "dQw4w9WgXcQ"; // 유명 영상
try {
  const segments = await YoutubeTranscript.fetchTranscript(TEST_VIDEO_ID, { lang: "en" });
  console.log(`✅ 자막 ${segments.length}개 세그먼트 추출 성공`);
  if (segments.length > 0) {
    console.log("  첫 세그먼트:", JSON.stringify(segments[0]));
  }
} catch (e) {
  console.log("❌ 자막 추출 실패:", e.message);

  // lang 없이 재시도
  console.log("  lang 없이 재시도...");
  try {
    const segments2 = await YoutubeTranscript.fetchTranscript(TEST_VIDEO_ID);
    console.log(`  ✅ lang 없이: ${segments2.length}개 세그먼트`);
  } catch (e2) {
    console.log("  ❌ lang 없이도 실패:", e2.message);
  }
}

// Step 3: Gemini API 키 확인
console.log("\n=== Step 3: Gemini API 키 확인 ===");
const apiKey = process.env.GEMINI_API_KEY;
if (apiKey) {
  console.log(`✅ GEMINI_API_KEY 설정됨 (${apiKey.length}자, ${apiKey.slice(0, 6)}...)`);
} else {
  console.log("❌ GEMINI_API_KEY 미설정!");
}

// Step 4: Gemini API 호출 테스트
console.log("\n=== Step 4: Gemini API 호출 테스트 ===");
if (apiKey) {
  try {
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent("Say hello in Korean. Reply in 5 words or less.");
    console.log("✅ Gemini 응답:", result.response.text().trim());
  } catch (e) {
    console.log("❌ Gemini API 실패:", e.message);
    if (e.status) console.log("  HTTP status:", e.status);
  }
} else {
  console.log("⏭️ API 키 없어 스킵");
}

// Step 5: 한국어 여행 영상으로 전체 흐름 테스트
console.log("\n=== Step 5: 여행 영상 전체 흐름 테스트 ===");
const TRAVEL_VIDEO_ID = "KdMkaBgnRbM"; // 일반적인 여행 영상
try {
  // 제목 가져오기
  const titleRes = await fetch(
    `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${TRAVEL_VIDEO_ID}&format=json`,
    { signal: AbortSignal.timeout(5000) }
  );
  const titleData = await titleRes.json();
  console.log("  영상 제목:", titleData.title);

  // 자막 추출
  let transcript;
  for (const lang of ["ko", "en", "ja"]) {
    try {
      transcript = await YoutubeTranscript.fetchTranscript(TRAVEL_VIDEO_ID, { lang });
      console.log(`  ✅ ${lang} 자막: ${transcript.length}개 세그먼트`);
      break;
    } catch {
      console.log(`  ⚠️ ${lang} 자막 없음`);
    }
  }

  if (!transcript) {
    try {
      transcript = await YoutubeTranscript.fetchTranscript(TRAVEL_VIDEO_ID);
      console.log(`  ✅ auto 자막: ${transcript.length}개 세그먼트`);
    } catch (e) {
      console.log("  ❌ 모든 자막 추출 실패:", e.message);
    }
  }
} catch (e) {
  console.log("❌ 전체 흐름 실패:", e.message);
}

console.log("\n=== 테스트 완료 ===");
