import { expect, test } from '@playwright/test';

function assertStandardErrorResponse(
  body: unknown
): asserts body is { success: false; error: string } {
  expect(body).toBeTruthy();
  expect(typeof body).toBe('object');

  const typed = body as Record<string, unknown>;
  expect(typed.success).toBe(false);
  expect(typeof typed.error).toBe('string');
  expect((typed.error as string).length).toBeGreaterThan(0);
  expect(typed).not.toHaveProperty('error.code');
  expect(typed).not.toHaveProperty('error.message');
}

test.describe('API Error Response Standardization (DEC-184)', () => {
  test('guest invite endpoint should return standardized BAD_REQUEST payload', async ({
    request,
  }) => {
    const response = await request.get('/api/guest/abc');

    expect(response.status()).toBe(400);
    assertStandardErrorResponse(await response.json());
  });

  test('guest invite endpoint should return standardized NOT_FOUND payload', async ({
    request,
  }) => {
    const missingInviteCode = `qa-missing-${Date.now().toString(36)}`;
    const response = await request.get(`/api/guest/${missingInviteCode}`);

    expect(response.status()).toBe(404);
    assertStandardErrorResponse(await response.json());
  });
});
