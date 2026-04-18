import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { buildTripContext, getSystemPrompt } from "@/lib/services/ai-context";
import { aiRecommendSchema } from "@/lib/api/schemas";
import { withAuth, checkRateLimit } from "@/lib/api/guards";
import { errorResponse } from "@/lib/api/error-response";
import { sanitizeUserMessage, detectInjectionAttempt } from "@/lib/services/ai-sanitize";

// Lazy init: 빌드 시 환경변수 부재로 prerender 실패 방지
let genAI: GoogleGenerativeAI | null = null;
function getGenAI(): GoogleGenerativeAI {
  if (!genAI) {
    const key = process.env.GEMINI_API_KEY?.trim();
    if (!key) throw new Error("GEMINI_API_KEY 환경변수가 설정되지 않았습니다");
    genAI = new GoogleGenerativeAI(key);
  }
  return genAI;
}

export const POST = withAuth(async (request, { supabase, user }) => {
  if (!(await checkRateLimit("ai-recommend", user.id, { maxRequests: 20 }))) {
    return errorResponse("RATE_LIMITED", "너무 많은 요청입니다. 잠시 후 다시 시도해주세요.");
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return errorResponse("BAD_REQUEST", "Invalid JSON body");
  }

  const parsed = aiRecommendSchema.safeParse(rawBody);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0];
    return errorResponse("BAD_REQUEST", firstError?.message ?? "입력이 올바르지 않습니다");
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
      .select("id, title, destination, start_date, end_date")
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
    return errorResponse("FORBIDDEN", "해당 여행에 접근할 수 없습니다");
  }

  const trip = tripRes.data;
  if (!trip) {
    return errorResponse("NOT_FOUND", "Trip not found");
  }

  const schedules = schedulesRes.data;
  const places = placesRes.data;

  // 컨텍스트 & 프롬프트 생성
  const context = buildTripContext(trip, places, schedules);
  const isFirstMessage = !history || history.length <= 1;
  const systemPrompt = getSystemPrompt(type, isFirstMessage);

  try {
    const model = getGenAI().getGenerativeModel({
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

    // 프롬프트 인젝션 감지 — 감지 시 차단
    if (detectInjectionAttempt(message)) {
      console.warn("[ai] Prompt injection attempt blocked:", user.id);
      return errorResponse("BAD_REQUEST", "허용되지 않는 입력입니다.");
    }

    // 사용자 메시지 새니타이징
    const safeMessage = sanitizeUserMessage(message);

    const chat = model.startChat({ history: chatHistory });
    const result = await chat.sendMessage(safeMessage);
    const response = result.response.text();

    return NextResponse.json({ message: response });
  } catch (error) {
    console.error("Gemini API error:", error);
    return errorResponse("INTERNAL_ERROR", "AI 응답 생성에 실패했습니다.");
  }
});
