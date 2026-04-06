import { Page } from '@playwright/test';

/**
 * Helper functions for authentication testing
 */

export async function signUp(
  page: Page,
  email: string,
  password: string,
  name: string
) {
  await page.goto('/auth/sign-up');

  // Fill signup form
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.fill('input[placeholder*="Name"]', name);

  // Submit form
  await page.click('button:has-text("Create Account")');

  // Wait for redirect to dashboard or auth confirmation
  await page.waitForURL(/\/(dashboard|trips)/, { timeout: 10000 });
}

export async function signIn(page: Page, email: string, password: string) {
  await page.goto('/auth/sign-in');

  // Fill login form
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);

  // Submit form
  await page.click('button:has-text("Sign In")');

  // Wait for redirect to dashboard
  await page.waitForURL(/\/(dashboard|trips)/, { timeout: 10000 });
}

export async function signOut(page: Page) {
  // Open user menu (usually top-right)
  await page.click('button[aria-label="User menu"]');

  // Click sign out
  await page.click('button:has-text("Sign Out")');

  // Wait for redirect to login
  await page.waitForURL('/auth/sign-in', { timeout: 5000 });
}

export async function isAuthenticated(page: Page): Promise<boolean> {
  try {
    // Check if we can reach a protected route
    await page.goto('/dashboard', { waitUntil: 'networkidle' });
    return !page.url().includes('/auth');
  } catch {
    return false;
  }
}

/**
 * Check if user is on auth page
 */
export async function isOnAuthPage(page: Page): Promise<boolean> {
  return page.url().includes('/auth');
}
