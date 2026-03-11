/**
 * 비정형 텍스트 입력을 URL / 장소명 / 에러로 분류하는 순수 함수.
 * PWA Share Target에서 들어오는 혼합 텍스트(광고+URL)를 안전하게 파싱한다.
 */

export type ResolvedInput =
  | { type: "url"; url: string; rawInput: string }
  | { type: "text"; placeName: string; rawInput: string }
  | { type: "error"; reason: string; rawInput: string };

const MAX_INPUT_LENGTH = 500;

// URL 추출 정규식: 괄호/꺾쇠/따옴표 안의 URL도 캡처
const URL_REGEX = /https?:\/\/[^\s)>\]"']+/;

// 프로토콜 없는 도메인 패턴 (booking.com/..., tripadvisor.com/... 등)
const BARE_DOMAIN_REGEX =
  /^(?:www\.)?(?:booking\.com|tripadvisor\.com|trip\.com|agoda\.com|hotels\.com|airbnb\.com|google\.com\/maps|maps\.app\.goo\.gl|naver\.me|traveloka\.com|klook\.com|expedia\.com)\b[^\s]*/i;

// 광고성/불필요 문구 제거 패턴
const NOISE_PATTERNS = [
  /\[광고\]/g,
  /\[AD\]/gi,
  /sponsored/gi,
  /\bhttps?:\/\/[^\s]+/g, // URL 제거 (장소명 추출 시)
  /[#@]\S+/g, // 해시태그/멘션
  /\d{2,4}[-/.]\d{1,2}[-/.]\d{1,2}/g, // 날짜
  /\d{1,3}(,\d{3})*원/g, // 가격
  /[~∼]\s*\d+%/g, // 할인율
  /\(?\d{2,4}[-.)]\d{3,4}[-.)]\d{4}\)?/g, // 전화번호
];

// 이모지 제거 (파싱 전처리용)
const EMOJI_REGEX =
  /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{200D}\u{20E3}]/gu;

export function resolveInput(raw: string): ResolvedInput {
  const rawInput = raw;

  // 1. 빈 값 체크
  const trimmed = raw.trim();
  if (!trimmed) {
    return { type: "error", reason: "입력이 비어 있습니다", rawInput };
  }

  // 2. 길이 제한 (500자로 잘라내기)
  const input = trimmed.length > MAX_INPUT_LENGTH
    ? trimmed.slice(0, MAX_INPUT_LENGTH)
    : trimmed;

  // 3. 입력 전체가 깨끗한 URL인지 확인
  try {
    const parsed = new URL(input);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") {
      return { type: "url", url: input, rawInput };
    }
    // javascript:, file:, data: 등 비허용 프로토콜
    return { type: "error", reason: "HTTP/HTTPS URL만 지원합니다", rawInput };
  } catch {
    // URL이 아님 → 다음 단계로
  }

  // 4. 텍스트에서 URL 추출
  const urlMatch = input.match(URL_REGEX);
  if (urlMatch) {
    const extractedUrl = urlMatch[0];
    // 추출된 URL 유효성 재확인
    try {
      const parsed = new URL(extractedUrl);
      if (parsed.protocol === "https:" || parsed.protocol === "http:") {
        return { type: "url", url: extractedUrl, rawInput };
      }
    } catch {
      // 추출 실패 → 텍스트 폴백
    }
  }

  // 5. 프로토콜 없는 도메인 패턴
  const bareDomainMatch = input.match(BARE_DOMAIN_REGEX);
  if (bareDomainMatch) {
    const urlWithProtocol = `https://${bareDomainMatch[0]}`;
    try {
      new URL(urlWithProtocol);
      return { type: "url", url: urlWithProtocol, rawInput };
    } catch {
      // 유효하지 않은 URL → 텍스트 폴백
    }
  }

  // 6. 장소명 추출 (광고 문구 제거)
  let cleaned = input;
  // 이모지 제거
  cleaned = cleaned.replace(EMOJI_REGEX, " ");
  // 노이즈 패턴 제거
  for (const pattern of NOISE_PATTERNS) {
    cleaned = cleaned.replace(pattern, " ");
  }
  // 연속 공백 정리
  cleaned = cleaned.replace(/\s+/g, " ").trim();

  // 장소명 길이 가드레일 (2~100자)
  if (cleaned.length < 2) {
    return { type: "error", reason: "장소명을 추출할 수 없습니다", rawInput };
  }
  if (cleaned.length > 100) {
    cleaned = cleaned.slice(0, 100).trim();
  }

  return { type: "text", placeName: cleaned, rawInput };
}
