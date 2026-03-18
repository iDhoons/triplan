import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/api/guards";
import { checkRateLimit } from "@/lib/api/guards";
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

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export const POST = withAuth(async (request, { user }) => {
  if (!checkRateLimit("checklist-classify", user.id, { maxRequests: 30 })) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429 }
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
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
