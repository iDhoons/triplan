import { describe, it, expect } from "vitest";

/**
 * Open Redirect 방어 로직 테스트.
 * auth/callback/route.ts에서 사용하는 검증 로직을 순수 함수로 테스트.
 */

function sanitizeNextParam(nextParam: string): string {
  return nextParam.startsWith("/") && !nextParam.startsWith("//")
    ? nextParam
    : "/dashboard";
}

describe("OAuth Open Redirect 방어", () => {
  it("정상적인 상대 경로 허용", () => {
    expect(sanitizeNextParam("/dashboard")).toBe("/dashboard");
    expect(sanitizeNextParam("/trips/123")).toBe("/trips/123");
    expect(sanitizeNextParam("/profile")).toBe("/profile");
  });

  it("외부 URL 차단 → /dashboard로 대체", () => {
    expect(sanitizeNextParam("https://evil.com")).toBe("/dashboard");
    expect(sanitizeNextParam("http://evil.com")).toBe("/dashboard");
  });

  it("프로토콜 상대 URL 차단 (//evil.com)", () => {
    expect(sanitizeNextParam("//evil.com")).toBe("/dashboard");
    expect(sanitizeNextParam("//evil.com/path")).toBe("/dashboard");
  });

  it("빈 문자열 차단", () => {
    expect(sanitizeNextParam("")).toBe("/dashboard");
  });

  it("상대 경로 아닌 값 차단", () => {
    expect(sanitizeNextParam("evil.com")).toBe("/dashboard");
    expect(sanitizeNextParam("javascript:alert(1)")).toBe("/dashboard");
  });
});

/**
 * Rate Limiter 로직 테스트
 */
import { checkRateLimit } from "../guards";

describe("checkRateLimit", () => {
  it("첫 요청은 통과", async () => {
    await expect(checkRateLimit("test-api", "user-1")).resolves.toBe(true);
  });

  it("제한 내 요청은 통과", async () => {
    const key = "test-api-2";
    for (let i = 0; i < 10; i++) {
      await expect(checkRateLimit(key, "user-2", { maxRequests: 10 })).resolves.toBe(true);
    }
  });

  it("제한 초과 시 차단", async () => {
    const key = "test-api-3";
    for (let i = 0; i < 5; i++) {
      await checkRateLimit(key, "user-3", { maxRequests: 5 });
    }
    await expect(checkRateLimit(key, "user-3", { maxRequests: 5 })).resolves.toBe(false);
  });

  it("다른 사용자는 독립적 카운트", async () => {
    const key = "test-api-4";
    for (let i = 0; i < 5; i++) {
      await checkRateLimit(key, "user-4a", { maxRequests: 5 });
    }
    // user-4a는 차단
    await expect(checkRateLimit(key, "user-4a", { maxRequests: 5 })).resolves.toBe(false);
    // user-4b는 통과
    await expect(checkRateLimit(key, "user-4b", { maxRequests: 5 })).resolves.toBe(true);
  });
});
