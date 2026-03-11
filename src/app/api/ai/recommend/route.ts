import { createClient } from "@/lib/supabase/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { buildTripContext, getSystemPrompt } from "@/lib/services/ai-context";
import { aiRecommendSchema } from "@/lib/api/schemas";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  // 권한 확인: 해당 여행의 멤버인지 체크
  const { data: membership } = await supabase
    .from("trip_members")
    .select("role")
    .eq("trip_id", trip_id)
    .eq("user_id", user.id)
    .single();

  if (!membership) {
    return NextResponse.json({ error: "해당 여행에 접근할 수 없습니다" }, { status: 403 });
  }

  // 여행 정보 조회
  const { data: trip } = await supabase
    .from("trips")
    .select("*")
    .eq("id", trip_id)
    .single();

  if (!trip) {
    return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  }

  // 일정 정보 조회 (장소 정보 포함)
  const { data: schedules } = await supabase
    .from("schedules")
    .select("*, schedule_items(*, place:places(*))")
    .eq("trip_id", trip_id)
    .order("date");

  // 장소 정보 조회
  const { data: places } = await supabase
    .from("places")
    .select("*")
    .eq("trip_id", trip_id);

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

    const chat = model.startChat({ history: chatHistory });
    const result = await chat.sendMessage(message);
    const response = result.response.text();

    return NextResponse.json({ message: response });
  } catch (error) {
    console.error("Gemini API error:", error);
    return NextResponse.json(
      { error: "AI 응답 생성에 실패했습니다." },
      { status: 500 }
    );
  }
}
