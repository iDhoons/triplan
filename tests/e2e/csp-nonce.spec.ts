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

test.describe("CSP nonce hardening (DEC-177)", () => {
  test("dashboard response should include nonce header and script-src nonce", async ({ request }) => {
    const response = await request.get("/dashboard", { maxRedirects: 0 });
    const csp = response.headers()["content-security-policy"];
    const nonce = response.headers()["x-nonce"];

    expect(csp).toBeTruthy();
    expect(nonce).toBeTruthy();

    const scriptSrc = getDirective(csp ?? "", "script-src");
    expect(scriptSrc).toContain("'self'");
    expect(scriptSrc).toContain(`'nonce-${nonce}'`);
    expect(scriptSrc).not.toContain("'unsafe-inline'");
  });

  test("login response should include nonce header and script-src nonce", async ({ request }) => {
    const response = await request.get("/login", { maxRedirects: 0 });
    const csp = response.headers()["content-security-policy"];
    const nonce = response.headers()["x-nonce"];

    expect(csp).toBeTruthy();
    expect(nonce).toBeTruthy();

    const scriptSrc = getDirective(csp ?? "", "script-src");
    expect(scriptSrc).toContain("'self'");
    expect(scriptSrc).toContain(`'nonce-${nonce}'`);
    expect(scriptSrc).not.toContain("'unsafe-inline'");
  });
});
