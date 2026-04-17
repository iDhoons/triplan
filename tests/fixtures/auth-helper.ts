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
  await page.goto('/login');
  await page.getByLabel('이메일').fill(email);
  await page.getByRole('button', { name: '로그인 링크 보내기' }).click();

  await Promise.race([
    page.waitForURL(/\/(dashboard|trips)/, { timeout: 10000 }),
    page.getByText('이메일을 확인해주세요').waitFor({ timeout: 10000 }),
  ]);
}

export async function signIn(page: Page, email: string, password: string) {
  await page.goto('/login');

  const devQuickLoginButton = page.getByRole('button', {
    name: /Dev 빠른 로그인/,
  });
  const requestedEmail = email.trim();
  if (await devQuickLoginButton.count()) {
    if (!requestedEmail) {
      await devQuickLoginButton.click();
      await page.waitForURL(/\/(dashboard|trips)/, { timeout: 10000 });
      return;
    }

    const quickLoginLabel = (await devQuickLoginButton.textContent()) ?? '';
    if (quickLoginLabel.includes(requestedEmail)) {
      await devQuickLoginButton.click();
      await page.waitForURL(/\/(dashboard|trips)/, { timeout: 10000 });
      return;
    }
  }

  await page.getByLabel('이메일').fill(email);
  const passwordField = page.locator('#password');
  if (await passwordField.count()) {
    await passwordField.fill(password);
    await page.getByRole('button', { name: '로그인' }).click();
    await page.waitForURL(/\/(dashboard|trips)/, { timeout: 10000 });
    return;
  }

  throw new Error(
    requestedEmail
      ? `요청한 계정(${requestedEmail})으로 로그인 가능한 경로가 없습니다.`
      : '자동 로그인 가능한 경로가 없습니다. Dev 빠른 로그인 또는 비밀번호 로그인이 필요합니다.'
  );
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
