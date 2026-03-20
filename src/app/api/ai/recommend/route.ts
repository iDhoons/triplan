import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { buildTripContext, getSystemPrompt } from "@/lib/services/ai-context";
import { aiRecommendSchema } from "@/lib/api/schemas";
import { withAuth } from "@/lib/api/guards";
import { sanitizeUserMessage, detectInjectionAttempt } from "@/lib/services/ai-sanitize";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export const POST = withAuth(async (request, { supabase, user }) => {

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = aiRecommendSchema.safeParse(rawBody);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0];
    return NextResponse.json(
      { error: firstError?.message ?? "입력이 올바르지 않습니다" },
      { status: 400 }
    );
  }

  const { trip_id, message, type, history } = parsed.data;

  // 권한 확인 + 여행/일정/장소 데이터를 병렬 조회
  const [membershipRes, tripRes, schedulesRes, placesRes] = await Promise.all([
    supabase
      .from("trip_members")
      .select("role")
      .eq("trip_id", trip_id)
      .eq("user_id", user.id)
      .single(),
    supabase
      .from("trips")
      .select("id, title, destination, start_date, end_date, style")
      .eq("id", trip_id)
      .single(),
    supabase
      .from("schedules")
      .select("*, schedule_items(*, place:places(*))")
      .eq("trip_id", trip_id)
      .order("date"),
    supabase
      .from("places")
      .select("id, name, category, address, latitude, longitude, rating, memo")
      .eq("trip_id", trip_id),
  ]);

  if (!membershipRes.data) {
    return NextResponse.json({ error: "해당 여행에 접근할 수 없습니다" }, { status: 403 });
  }

  const trip = tripRes.data;
  if (!trip) {
    return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  }

  const schedules = schedulesRes.data;
  const places = placesRes.data;

  // 컨텍스트 & 프롬프트 생성
  const context = buildTripContext(trip, places, schedules);
  const isFirstMessage = !history || history.length <= 1;
  const systemPrompt = getSystemPrompt(type, isFirstMessage);

  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      systemInstruction: `${systemPrompt}\n\n여행 컨텍스트:\n${context}`,
    });

    // 이전 대화 히스토리를 Gemini 형식으로 변환 (마지막 user 메시지 제외)
    const chatHistory = (history || [])
      .slice(0, -1) // 마지막 메시지(현재 보내는 것)는 sendMessage로 전달
      .map((m) => ({
        role: m.role === "assistant" ? "model" as const : "user" as const,
        parts: [{ text: m.content }],
      }));

    // 프롬프트 인젝션 감지 (로깅용)
    if (detectInjectionAttempt(message)) {
      console.warn("[ai] Prompt injection attempt detected:", user.id);
    }

    // 사용자 메시지 새니타이징
    const safeMessage = sanitizeUserMessage(message);

    const chat = model.startChat({ history: chatHistory });
    const result = await chat.sendMessage(safeMessage);
    const response = result.response.text();

    return NextResponse.json({ message: response });
  } catch (error) {
    console.error("Gemini API error:", error);
    return NextResponse.json(
      { error: "AI 응답 생성에 실패했습니다." },
      { status: 500 }
    );
  }
});
