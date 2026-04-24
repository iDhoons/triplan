import { test, expect } from '@playwright/test';
import { canBootstrapSession, signIn } from '../fixtures/auth-helper';

/**
 * Authentication smoke tests for the current auth UI.
 */

test.describe('Authentication', () => {
  test('login page should render current auth UI', async ({ page }) => {
    await page.goto('/login');

    await expect(
      page.getByRole('heading', { name: '여행 플래너' })
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Google로 로그인' })
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
      page.getByRole('button', { name: 'Google로 로그인' })
    ).toBeVisible();
  });

  test('fixture session bootstrap can access dashboard', async ({
    page,
  }) => {
    test.skip(
      !canBootstrapSession(),
      'requires Supabase test env for session bootstrap'
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
