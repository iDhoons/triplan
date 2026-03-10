import { createClient } from "@/lib/supabase/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { trip_id, message, type } = body;

  // 여행 정보 조회
  const { data: trip } = await supabase
    .from("trips")
    .select("*")
    .eq("id", trip_id)
    .single();

  if (!trip) {
    return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  }

  // 일정 정보 조회
  const { data: schedules } = await supabase
    .from("schedules")
    .select("*, schedule_items(*)")
    .eq("trip_id", trip_id)
    .order("date");

  // 장소 정보 조회
  const { data: places } = await supabase
    .from("places")
    .select("*")
    .eq("trip_id", trip_id);

  const context = `
여행 정보:
- 제목: ${trip.title}
- 목적지: ${trip.destination}
- 기간: ${trip.start_date} ~ ${trip.end_date}

등록된 장소: ${places?.map((p: { name: string; category: string }) => `${p.name}(${p.category})`).join(", ") || "없음"}

현재 일정:
${
  schedules
    ?.map(
      (s: { date: string; schedule_items: { title: string; start_time: string | null; end_time: string | null }[] }) =>
        `${s.date}: ${s.schedule_items?.map((i) => `${i.title}(${i.start_time || ""}~${i.end_time || ""})`).join(", ") || "비어있음"}`
    )
    .join("\n") || "없음"
}
`;

  let systemPrompt = "";

  switch (type) {
    case "recommend":
      systemPrompt = `당신은 여행 전문가입니다. 아래 여행 컨텍스트를 참고하여 맛집, 관광지, 교통편을 추천해주세요.
추천할 때는 이름, 간단한 설명, 예상 비용, 이동 방법을 포함해주세요.
한국어로 답변하세요.`;
      break;
    case "generate-schedule":
      systemPrompt = `당신은 여행 일정 전문가입니다. 아래 여행 컨텍스트를 참고하여 효율적인 일정을 제안해주세요.
시간대별로 구체적인 일정을 작성하고, 이동 시간도 고려해주세요.
한국어로 답변하세요.`;
      break;
    case "route-check":
      systemPrompt = `당신은 여행 동선 분석가입니다. 아래 일정의 동선을 분석하고, 비효율적인 부분이 있으면 개선 방안을 제안해주세요.
한국어로 답변하세요.`;
      break;
    default:
      systemPrompt = `당신은 친절한 여행 어시스턴트입니다. 아래 여행 컨텍스트를 참고하여 질문에 답변해주세요.
한국어로 답변하세요.`;
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent([
      { text: systemPrompt },
      { text: `여행 컨텍스트:\n${context}` },
      { text: `사용자 질문: ${message}` },
    ]);

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
