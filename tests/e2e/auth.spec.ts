import { test, expect } from '@playwright/test';
import { signIn } from '../fixtures/auth-helper';

/**
 * Authentication smoke tests for the current auth UI.
 */

test.describe('Authentication', () => {
  test('login page should render current auth UI', async ({ page }) => {
    await page.goto('/login');

    await expect(
      page.getByRole('heading', { name: '여행 플래너' })
    ).toBeVisible();
    await expect(page.getByLabel('이메일')).toBeVisible();
    await expect(
      page.getByRole('button', { name: '로그인 링크 보내기' })
    ).toBeVisible();
    await expect(
      page.getByText('처음 사용하시면 자동으로 가입됩니다.')
    ).toBeVisible();
  });

  test('signup page should redirect to login', async ({
    page,
  }) => {
    await page.goto('/signup', { waitUntil: 'domcontentloaded' });
    await page.waitForURL(/\/login/, { timeout: 10000 });
    await expect(page.getByRole('heading', { name: '여행 플래너' })).toBeVisible();
  });

  test('dashboard should redirect unauthenticated users to login', async ({
    page,
  }) => {
    await page.goto('/dashboard');
    await page.waitForURL(/\/login/, { timeout: 10000 });
    await expect(
      page.getByRole('button', { name: '로그인 링크 보내기' })
    ).toBeVisible();
  });

  test('dev quick login can access dashboard when available', async ({
    page,
  }) => {
    await page.goto('/login');
    const devQuickLoginButton = page.getByRole('button', {
      name: /Dev 빠른 로그인/,
    });
    test.skip(
      (await devQuickLoginButton.count()) === 0,
      'requires development quick login button'
    );

    await signIn(
      page,
      process.env.E2E_AUTH_EMAIL ?? '',
      process.env.E2E_AUTH_PASSWORD ?? ''
    );

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(
      page.getByRole('button', { name: '새 여행 만들기' })
    ).toBeVisible();
  });

});
