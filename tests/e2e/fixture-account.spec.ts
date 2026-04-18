import { test, expect } from '@playwright/test';
import { signIn } from '../fixtures/auth-helper';

const fixtureEmail = 'test-alice@triplan.test';
const fixturePassword = 'TestPassword123!@#';

test.describe('Fixture Account QA', () => {
  test('fixture login path works and session cleanup redirects to login', async ({
    page,
    context,
  }) => {
    await page.goto('/login');

    const devQuickLoginButton = page.getByRole('button', {
      name: /Dev 빠른 로그인/,
    });
    await expect(devQuickLoginButton).toBeVisible();
    await expect(devQuickLoginButton).toContainText(fixtureEmail);

    await signIn(page, fixtureEmail, fixturePassword);
    await expect(page).toHaveURL(/\/dashboard/);

    await expect(
      page.getByRole('navigation', { name: '메인 네비게이션' })
    ).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('link', { name: '체크리스트' })).toBeVisible();

    await page.goto('/checklist');
    await expect(page).toHaveURL(/\/checklist/);

    await context.clearCookies();
    await page.evaluate(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });

    await page.goto('/dashboard');
    await page.waitForURL(/\/login/, { timeout: 15000 });
  });
});
