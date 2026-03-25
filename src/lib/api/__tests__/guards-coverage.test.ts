import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

/**
 * 가드 적용 검증 테스트
 * 모든 API Route가 withAuth 또는 withTripMember를 사용하는지 확인한다.
 * auth/callback은 OAuth 콜백이므로 예외.
 */

const API_DIR = join(process.cwd(), "src/app/api");

// 인증이 불필요한 예외 경로
const EXEMPT_PATHS = [
  "auth/callback", // OAuth callback — Supabase가 직접 호출
  "guest",         // 게스트 미리보기 — 공개 엔드포인트 (자체 rate limiting 적용)
];

function findRouteFiles(dir: string, base = ""): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const relativePath = base ? `${base}/${entry}` : entry;
    if (statSync(fullPath).isDirectory()) {
      files.push(...findRouteFiles(fullPath, relativePath));
    } else if (entry === "route.ts") {
      files.push(relativePath);
    }
  }
  return files;
}

describe("API Guard Coverage", () => {
  const routeFiles = findRouteFiles(API_DIR);

  it("API route 파일이 존재한다", () => {
    expect(routeFiles.length).toBeGreaterThan(0);
  });

  for (const relPath of routeFiles) {
    const routeName = relPath.replace("/route.ts", "");
    const isExempt = EXEMPT_PATHS.some((ex) => routeName.includes(ex));

    if (isExempt) {
      it(`[예외] ${routeName} — 인증 불필요 (OAuth 콜백)`, () => {
        // 예외 경로는 withAuth 없어도 OK
        expect(true).toBe(true);
      });
      continue;
    }

    it(`${routeName} — withAuth/withTripMember/withTripEditor를 호출한다`, () => {
      const content = readFileSync(join(API_DIR, relPath), "utf-8");
      // 실제 호출 패턴 검사 (import만으로는 부족 — 함수 호출 `(` 포함)
      const usesGuard =
        content.includes("withAuth(") ||
        content.includes("withTripMember(") ||
        content.includes("withTripEditor(");
      expect(
        usesGuard,
        `${routeName}에 withAuth/withTripMember/withTripEditor 호출이 없습니다! guards.ts를 사용하세요.`
      ).toBe(true);
    });
  }
});

describe("Rate Limiter 중복 방지", () => {
  const routeFiles = findRouteFiles(API_DIR);

  for (const relPath of routeFiles) {
    const routeName = relPath.replace("/route.ts", "");

    it(`${routeName} — 자체 rateLimitMap을 정의하지 않는다`, () => {
      const content = readFileSync(join(API_DIR, relPath), "utf-8");
      const hasOwnRateLimiter =
        content.includes("new Map<string, { count:") ||
        (content.includes("rateLimitMap") && !content.includes("from \"@/lib/api/guards\""));
      expect(
        hasOwnRateLimiter,
        `${routeName}에 자체 Rate Limiter가 있습니다! guards.ts의 checkRateLimit을 사용하세요.`
      ).toBe(false);
    });
  }
});
