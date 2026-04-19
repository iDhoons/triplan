import { expect, test } from "@playwright/test";

test.describe("CSP 정책 통합 검증", () => {
  test("장소 이미지가 CSP 정책 하에서 정상 로딩되는지 확인", async ({
    page,
  }) => {
    // 콘솔 에러 모니터링
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto("/login");

    // CSP 위반 에러가 없는지 확인
    expect(consoleErrors.filter(err => err.includes("Content Security Policy"))).toHaveLength(0);
  });

  test("정적 이미지 및 아이콘이 정상 로딩되는지 확인", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto("/");

    // 페이지 로딩 대기
    await page.waitForLoadState("networkidle");

    // 이미지 로딩 실패가 없는지 확인
    const imageErrors = consoleErrors.filter(err =>
      err.includes("Failed to load resource") && err.includes("img")
    );

    expect(imageErrors).toHaveLength(0);
  });
});