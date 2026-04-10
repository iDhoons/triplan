import { test, expect } from '@playwright/test';
import { signIn } from '../fixtures/auth-helper';

/**
 * Authenticated trip management smoke tests.
 * These require a seeded account and are skipped in CI unless creds are provided.
 */

test.describe('Travel Planning Flows', () => {
  test('seeded user can open the create-trip dialog from dashboard', async ({
    page,
  }) => {
    test.skip(
      !process.env.E2E_AUTH_EMAIL || !process.env.E2E_AUTH_PASSWORD,
      'requires seeded E2E auth credentials'
    );

    await signIn(
      page,
      process.env.E2E_AUTH_EMAIL!,
      process.env.E2E_AUTH_PASSWORD!
    );

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole('heading', { name: '내 여행' })).toBeVisible();

    await page.getByRole('button', { name: '새 여행 만들기' }).click();

    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByPlaceholder('오사카 가족여행')).toBeVisible();
    await expect(page.getByPlaceholder('오사카, 일본')).toBeVisible();
    await expect(page.getByRole('button', { name: '만들기' })).toBeVisible();
  });
});
