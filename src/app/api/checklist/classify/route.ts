import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth, checkRateLimit } from "@/lib/api/guards";
import { errorResponse } from "@/lib/api/error-response";
import { classifyByKeyword } from "@/lib/checklist/classify";

const schema = z.object({
  title: z.string().min(1).max(200),
});

const VALID_CATEGORIES = [
  "documents",
  "clothing",
  "electronics",
  "hygiene",
  "shared",
  "todo",
  "shopping",
] as const;

// @TASK T7.12 - 빈 문자열도 거부 (falsy 체크)
if (!process.env.GEMINI_API_KEY?.trim()) {
  throw new Error("GEMINI_API_KEY 환경변수가 설정되지 않았습니다");
}
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export const POST = withAuth(async (request, { user }) => {
  if (!checkRateLimit("checklist-classify", user.id, { maxRequests: 30 })) {
    return errorResponse("RATE_LIMITED", "Too many requests");
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return errorResponse("BAD_REQUEST", "Invalid JSON");
  }

  const parsed = schema.safeParse(rawBody);
  if (!parsed.success) {
    return errorResponse("BAD_REQUEST", "Invalid input");
  }

  const { title } = parsed.data;

  // 1차: 키워드 매칭
  const keywordResult = classifyByKeyword(title);
  if (keywordResult) {
    return NextResponse.json({ category: keywordResult, source: "keyword" });
  }

  // 2차: Gemini
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent(
      `여행 체크리스트 항목 "${title}"을 아래 카테고리 중 하나로 분류해. 카테고리 key만 응답해.\n` +
        "documents(필수 서류), clothing(의류), electronics(전자기기), " +
        "hygiene(세면/의약), shared(공동 준비물), todo(할 일), shopping(쇼핑)\n" +
        "응답: 카테고리 key 하나만"
    );

    const text = result.response.text().trim().toLowerCase();
    const category = VALID_CATEGORIES.find((c) => text.includes(c));

    return NextResponse.json({
      category: category ?? "shared",
      source: category ? "ai" : "default",
    });
  } catch (error) {
    console.error("Gemini classify error:", error);
    return NextResponse.json({ category: "shared", source: "default" });
  }
});
