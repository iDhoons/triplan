/**
 * AI 프롬프트 인젝션 기초 방어.
 * - 사용자 입력에서 시스템 프롬프트 조작 시도를 감지/제거
 * - DB 데이터(장소명, 메모 등)를 프롬프트에 삽입할 때 이스케이프
 */

// 프롬프트 인젝션에 자주 사용되는 패턴
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|above|prior)\s+(instructions?|prompts?|rules?)/gi,
  /disregard\s+(all\s+)?(previous|above|prior)/gi,
  /you\s+are\s+now\s+/gi,
  /new\s+instructions?:/gi,
  /system\s*:\s*/gi,
  /\[SYSTEM\]/gi,
  /\[INST\]/gi,
  /<<SYS>>/gi,
  /<\|im_start\|>/gi,
  /act\s+as\s+(if\s+)?you\s+(are|were)\s+/gi,
  /pretend\s+(that\s+)?you\s+(are|were)\s+/gi,
  /from\s+now\s+on,?\s+(you\s+)?(will|must|should)/gi,
  /override\s+(your|the|all)\s+(instructions?|rules?|system)/gi,
];

/**
 * 사용자 메시지에서 프롬프트 인젝션 패턴을 제거한다.
 * 완벽한 방어는 아니지만, 가장 흔한 공격 벡터를 차단한다.
 */
export function sanitizeUserMessage(message: string): string {
  let cleaned = message;
  for (const pattern of INJECTION_PATTERNS) {
    cleaned = cleaned.replace(pattern, "[필터됨]");
  }
  return cleaned;
}

/**
 * DB에서 가져온 데이터를 프롬프트에 안전하게 삽입하기 위해 이스케이프한다.
 * 장소 메모 등에 악의적 지시가 저장된 경우를 방어한다.
 */
export function escapeForPrompt(text: string): string {
  // 프롬프트 구분자로 사용될 수 있는 패턴 이스케이프
  return text
    .replace(/```/g, "")
    .replace(/---/g, "")
    .replace(/\[SYSTEM\]/gi, "")
    .replace(/\[INST\]/gi, "")
    .replace(/<<SYS>>/gi, "")
    .replace(/<\|im_start\|>/gi, "");
}

/**
 * 프롬프트 인젝션 시도 여부를 감지한다 (로깅/모니터링용).
 */
export function detectInjectionAttempt(message: string): boolean {
  return INJECTION_PATTERNS.some((pattern) => {
    pattern.lastIndex = 0; // reset regex state
    return pattern.test(message);
  });
}
