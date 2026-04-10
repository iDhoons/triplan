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
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.getByRole('button', { name: '로그인' })).toBeVisible();

    const signupLink = page.getByRole('link', { name: '회원가입' });
    await expect(signupLink).toBeVisible();
    await expect(signupLink).toHaveAttribute('href', '/signup');
  });

  test('signup page should render current registration UI', async ({
    page,
  }) => {
    await page.goto('/signup');

    await expect(page.getByRole('heading', { name: '회원가입' })).toBeVisible();
    await expect(page.locator('#name')).toBeVisible();
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.getByRole('button', { name: '가입하기' })).toBeVisible();

    const loginLink = page.getByRole('link', { name: '로그인' });
    await expect(loginLink).toBeVisible();
    await expect(loginLink).toHaveAttribute('href', '/login');
  });

  test('dashboard should redirect unauthenticated users to login', async ({
    page,
  }) => {
    await page.goto('/dashboard');
    await page.waitForURL(/\/login/, { timeout: 10000 });
    await expect(page.getByRole('button', { name: '로그인' })).toBeVisible();
  });

  test('seeded user can sign in and access dashboard', async ({ page }) => {
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
  });
});
