import { Page } from '@playwright/test';

/**
 * Helper functions for authentication testing.
 */

export async function signUp(
  page: Page,
  email: string,
  password: string,
  name: string
) {
  await page.goto('/signup');
  await page.fill('#name', name);
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.getByRole('button', { name: '가입하기' }).click();

  await Promise.race([
    page.waitForURL(/\/(dashboard|trips)/, { timeout: 10000 }),
    page.getByText('이메일을 확인해주세요').waitFor({ timeout: 10000 }),
  ]);
}

export async function signIn(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.getByRole('button', { name: '로그인' }).click();
  await page.waitForURL(/\/(dashboard|trips)/, { timeout: 10000 });
}

export async function signOut(page: Page) {
  await page.locator('button').last().click();
  await page.getByRole('menuitem', { name: '로그아웃' }).click();
  await page.waitForURL(/\/login/, { timeout: 5000 });
}

export async function isAuthenticated(page: Page): Promise<boolean> {
  try {
    await page.goto('/dashboard', { waitUntil: 'networkidle' });
    return !page.url().includes('/login') && !page.url().includes('/signup');
  } catch {
    return false;
  }
}

export async function isOnAuthPage(page: Page): Promise<boolean> {
  return page.url().includes('/login') || page.url().includes('/signup');
}
