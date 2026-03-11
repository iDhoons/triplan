// ─── Types ──────────────────────────────────────────────

interface ScheduleItemWithPlace {
  title: string;
  start_time: string | null;
  end_time: string | null;
  memo: string | null;
  place: {
    name: string;
    category: string;
    address: string | null;
    latitude: number | null;
    longitude: number | null;
  } | null;
}

interface ScheduleWithItems {
  date: string;
  day_memo: string | null;
  schedule_items: ScheduleItemWithPlace[];
}

interface TripInfo {
  title: string;
  destination: string;
  start_date: string;
  end_date: string;
}

interface PlaceInfo {
  name: string;
  category: string;
  address: string | null;
}

// ─── Constants ──────────────────────────────────────────

const categoryMap: Record<string, string> = {
  accommodation: "숙소",
  attraction: "관광지",
  restaurant: "맛집",
  other: "기타",
};

// ─── Prompt Type ────────────────────────────────────────

type AiType = "recommend" | "generate-schedule" | "route-check" | "fill-empty";

// ─── Functions ──────────────────────────────────────────

/**
 * 여행 정보를 Gemini에 보낼 컨텍스트 문자열로 조합하는 순수 함수.
 */
export function buildTripContext(
  trip: TripInfo,
  places: PlaceInfo[] | null,
  schedules: ScheduleWithItems[] | null
): string {
  const scheduleDetail =
    schedules
      ?.map((s) => {
        const items = s.schedule_items || [];
        if (items.length === 0) {
          return `${s.date}: [빈 일정 - 추천 필요]`;
        }

        // 시간대별 빈 틈 분석
        const filledSlots = items
          .filter((i) => i.start_time && i.end_time)
          .map(
            (i) =>
              `  - ${i.start_time}~${i.end_time}: ${i.title}${i.place ? ` (${i.place.category}, ${i.place.address || ""})` : ""}`
          )
          .join("\n");

        const noTimeSlots = items
          .filter((i) => !i.start_time || !i.end_time)
          .map((i) => `  - (시간 미정): ${i.title}`)
          .join("\n");

        return `${s.date}${s.day_memo ? ` (메모: ${s.day_memo})` : ""}:\n${filledSlots}${noTimeSlots ? "\n" + noTimeSlots : ""}`;
      })
      .join("\n") || "없음";

  return `
여행 정보:
- 제목: ${trip.title}
- 목적지: ${trip.destination}
- 기간: ${trip.start_date} ~ ${trip.end_date}

등록된 장소:
${places?.map((p) => `- ${p.name} (${categoryMap[p.category] || p.category}${p.address ? ", " + p.address : ""})`).join("\n") || "없음"}

현재 일정:
${scheduleDetail}
`;
}

/**
 * type과 isFirstMessage에 따라 적절한 시스템 프롬프트를 반환하는 순수 함수.
 */
export function getSystemPrompt(
  type: AiType | undefined,
  isFirstMessage: boolean
): string {
  switch (type) {
    case "recommend":
      return isFirstMessage
        ? `당신은 여행 전문가입니다. 사용자에게 추천하기 전에 먼저 취향을 파악하세요.
다음 중 1~2가지를 간결하게 물어보세요:
- 어떤 종류의 음식/활동을 좋아하는지 (예: 현지 로컬 맛집? 유명 관광지? 힐링?)
- 예산 범위 (가성비? 럭셔리?)
- 특별히 피하고 싶은 것이 있는지
질문은 친근하고 짧게, 2~3개 이내로. 한국어로 답변하세요.`
        : `당신은 여행 전문가입니다. 사용자의 이전 답변을 바탕으로 맞춤 추천을 해주세요.
추천할 때는 이름, 간단한 설명, 예상 비용, 이동 방법을 포함해주세요.
한국어로 답변하세요.`;

    case "generate-schedule":
      return isFirstMessage
        ? `당신은 여행 일정 전문가입니다. 일정을 만들기 전에 사용자에게 간단히 물어보세요:
- 하루 일정 강도 (빡빡하게? 여유롭게?)
- 꼭 포함하고 싶은 활동이나 장소가 있는지
- 아침형? 저녁형? (몇 시쯤 시작하고 싶은지)
질문은 친근하고 짧게. 한국어로 답변하세요.`
        : `당신은 여행 일정 전문가입니다. 사용자의 답변을 반영하여 효율적인 일정을 제안해주세요.
시간대별로 구체적인 일정을 작성하고, 이동 시간도 고려해주세요.
한국어로 답변하세요.`;

    case "route-check":
      return `당신은 여행 동선 분석가입니다. 아래 일정의 동선을 분석하고, 비효율적인 부분이 있으면 개선 방안을 제안해주세요.
한국어로 답변하세요.`;

    case "fill-empty":
      return isFirstMessage
        ? `당신은 현지 여행 전문가입니다. 빈 일정을 채우기 전에, 사용자의 취향을 먼저 파악하세요.

먼저 여행 컨텍스트에서 빈 일정이 있는 날짜를 확인하고, 사용자에게 다음을 간결하게 물어보세요:
1. "X일, Y일에 빈 시간이 있는데요!" 라고 빈 일정 현황을 알려주고
2. 어떤 스타일의 활동을 선호하는지 (관광/맛집탐방/쇼핑/체험/힐링 등)
3. 체력적으로 많이 걷는 것이 괜찮은지
질문은 친근하고 짧게, 3개 이내로. 한국어로 답변하세요.`
        : `당신은 현지 여행 전문가입니다. 사용자의 답변을 바탕으로 빈 일정에 맞춤 활동을 추천해주세요.

추천 규칙:
1. 해당 날짜에 이미 계획된 장소의 위치를 참고하여 근처에서 할 수 있는 것을 추천
2. 이미 방문하는 장소와 겹치지 않게 다양하게 추천
3. 시간대를 고려 (아침→카페/조식, 점심→맛집, 오후→관광/체험, 저녁→야경/바)
4. 각 추천에 이름, 한 줄 설명, 추천 시간대, 왜 어울리는지 포함
5. 사용자가 말한 선호/체력을 반드시 반영

한국어로 답변하세요.`;

    default:
      return `당신은 친절한 여행 어시스턴트입니다. 아래 여행 컨텍스트를 참고하여 질문에 답변해주세요.
한국어로 답변하세요.`;
  }
}
