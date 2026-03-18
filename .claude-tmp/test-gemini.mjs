/**
 * Gemini API 단독 테스트
 * 실행: node --env-file=.env.local .claude-tmp/test-gemini.mjs
 */
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

// Step 1: API 키 확인
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.log("❌ GEMINI_API_KEY가 .env.local에 설정되지 않았습니다!");
  process.exit(1);
}
console.log(`✅ GEMINI_API_KEY 설정됨 (${apiKey.length}자)`);

// Step 2: 간단한 호출
console.log("\n=== Gemini 기본 호출 테스트 ===");
const genAI = new GoogleGenerativeAI(apiKey);
try {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
  const result = await model.generateContent("Say hi in Korean, 5 words max.");
  console.log("✅ 기본 호출 성공:", result.response.text().trim());
} catch (e) {
  console.log("❌ 기본 호출 실패:", e.message);
  if (e.status) console.log("  HTTP status:", e.status);
  if (e.errorDetails) console.log("  Details:", JSON.stringify(e.errorDetails));
  process.exit(1);
}

// Step 3: 구조화된 응답 (실제 장소 추출과 동일한 스키마)
console.log("\n=== 구조화된 응답 테스트 (장소 추출 스키마) ===");
try {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: SchemaType.ARRAY,
        items: {
          type: SchemaType.OBJECT,
          properties: {
            name: { type: SchemaType.STRING },
            category: {
              type: SchemaType.STRING,
              format: "enum",
              enum: ["restaurant", "attraction", "accommodation", "other"],
            },
            timestamp: { type: SchemaType.STRING },
            context: { type: SchemaType.STRING },
            confidence: {
              type: SchemaType.STRING,
              format: "enum",
              enum: ["high", "medium", "low"],
            },
          },
          required: ["name", "category", "context", "confidence"],
        },
      },
    },
  });

  const result = await model.generateContent({
    systemInstruction: "여행 영상 분석 전문가입니다.",
    contents: [{
      role: "user",
      parts: [{
        text: `다음 자막에서 장소를 추출해주세요.

영상 제목: 도쿄 3박4일 여행 브이로그

"""자막 시작"""
[00:15] 오늘 시부야 스크램블 교차로에 왔어요
[01:20] 이치란 라멘 시부야점에서 라멘 먹었습니다
[03:45] 메이지진구 신사도 구경했어요
"""자막 끝"""`,
      }],
    }],
  });

  const text = result.response.text();
  const places = JSON.parse(text);
  console.log(`✅ 구조화 응답 성공: ${places.length}개 장소`);
  for (const p of places) {
    console.log(`  - ${p.name} (${p.category}, ${p.confidence})`);
  }
} catch (e) {
  console.log("❌ 구조화 응답 실패:", e.message);
  if (e.status) console.log("  HTTP status:", e.status);
}

console.log("\n=== 테스트 완료 ===");
