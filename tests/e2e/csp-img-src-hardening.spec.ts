import { expect, test } from "@playwright/test";

function getDirective(csp: string, directive: string): string {
  const prefix = `${directive} `;
  return (
    csp
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(prefix)) ?? ""
  );
}

test.describe("CSP img-src hardening (DEC-90)", () => {
  test("img-src should not allow places.googleapis.com", async ({ request }) => {
    const response = await request.get("/dashboard", { maxRedirects: 0 });
    const csp = response.headers()["content-security-policy"];

    expect(csp).toBeTruthy();

    const imgSrc = getDirective(csp ?? "", "img-src");
    expect(imgSrc).toContain("'self'");
    expect(imgSrc).not.toContain("places.googleapis.com");
    expect(imgSrc).toContain("https://maps.googleapis.com");
    expect(imgSrc).toContain("https://maps.gstatic.com");
  });

  test("connect-src should still allow places.googleapis.com API calls", async ({
    request,
  }) => {
    const response = await request.get("/dashboard", { maxRedirects: 0 });
    const csp = response.headers()["content-security-policy"];

    expect(csp).toBeTruthy();

    const connectSrc = getDirective(csp ?? "", "connect-src");
    expect(connectSrc).toContain("https://places.googleapis.com");
  });
});
