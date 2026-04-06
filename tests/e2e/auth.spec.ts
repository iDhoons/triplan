import { test, expect } from '@playwright/test';
import { signUp, signIn, signOut, isAuthenticated } from '../fixtures/auth-helper';
import { testUsers } from '../fixtures/test-data';

/**
 * Authentication E2E Tests
 * Critical flow for user onboarding
 */

test.describe('Authentication', () => {
  test.describe('Sign Up Flow', () => {
    test('should allow new user to create account', async ({ page }) => {
      const testUser = testUsers.alice;
      const uniqueEmail = `test-${Date.now()}@triplan.test`;

      await page.goto('/auth/sign-up');

      // Check page loads
      await expect(page).toHaveTitle(/Sign Up/i);

      // Fill form
      await page.fill('input[type="email"]', uniqueEmail);
      await page.fill('input[type="password"]', testUser.password);
      await page.fill('input[name*="name" i]', testUser.name);

      // Submit
      await page.click('button:has-text("Sign Up")');

      // Should redirect to dashboard or confirmation
      await page.waitForURL(/\/(dashboard|trips)/, { timeout: 10000 });
      expect(await isAuthenticated(page)).toBe(true);
    });

    test('should show validation error for invalid email', async ({ page }) => {
      await page.goto('/auth/sign-up');

      // Fill with invalid email
      await page.fill('input[type="email"]', 'not-an-email');
      await page.fill('input[type="password"]', 'ValidPass123!');
      await page.fill('input[name*="name" i]', 'Test User');

      // Submit
      await page.click('button:has-text("Sign Up")');

      // Check for error message
      await expect(page.locator('text=Invalid email')).toBeVisible();
    });

    test('should show validation error for weak password', async ({ page }) => {
      await page.goto('/auth/sign-up');

      // Fill with weak password
      await page.fill('input[type="email"]', `test-${Date.now()}@triplan.test`);
      await page.fill('input[type="password"]', '123'); // Too short
      await page.fill('input[name*="name" i]', 'Test User');

      // Submit
      await page.click('button:has-text("Sign Up")');

      // Check for error message
      await expect(
        page.locator('text=/password|must be/i')
      ).toBeVisible();
    });
  });

  test.describe('Sign In Flow', () => {
    test('should allow registered user to sign in', async ({ page }) => {
      // Assuming test user exists
      const testUser = testUsers.alice;

      await page.goto('/auth/sign-in');

      // Check page loads
      await expect(page).toHaveTitle(/Sign In/i);

      // Fill form
      await page.fill('input[type="email"]', testUser.email);
      await page.fill('input[type="password"]', testUser.password);

      // Submit
      await page.click('button:has-text("Sign In")');

      // Should redirect to dashboard
      await page.waitForURL(/\/(dashboard|trips)/, { timeout: 10000 });
      expect(await isAuthenticated(page)).toBe(true);
    });

    test('should show error for incorrect password', async ({ page }) => {
      const testUser = testUsers.alice;

      await page.goto('/auth/sign-in');

      // Fill form with wrong password
      await page.fill('input[type="email"]', testUser.email);
      await page.fill('input[type="password"]', 'WrongPassword123');

      // Submit
      await page.click('button:has-text("Sign In")');

      // Check for error message
      await expect(
        page.locator('text=/invalid|incorrect/i')
      ).toBeVisible();
    });

    test('should show error for non-existent user', async ({ page }) => {
      await page.goto('/auth/sign-in');

      // Fill form
      await page.fill('input[type="email"]', 'nonexistent@triplan.test');
      await page.fill('input[type="password"]', 'AnyPassword123');

      // Submit
      await page.click('button:has-text("Sign In")');

      // Check for error message
      await expect(
        page.locator('text=/not found|doesn.*exist/i')
      ).toBeVisible();
    });
  });

  test.describe('Sign Out Flow', () => {
    test('should allow authenticated user to sign out', async ({ page }) => {
      // First sign in
      const testUser = testUsers.alice;
      await signIn(page, testUser.email, testUser.password);
      expect(await isAuthenticated(page)).toBe(true);

      // Sign out
      await signOut(page);

      // Should be redirected to auth page
      expect(await isAuthenticated(page)).toBe(false);
    });
  });

  test.describe('Protected Routes', () => {
    test('should redirect unauthenticated user to login', async ({ page }) => {
      // Try to access protected route without auth
      await page.goto('/dashboard');

      // Should redirect to login
      expect(page.url()).toContain('/auth/sign-in');
    });

    test('should allow authenticated user to access protected routes', async ({
      page,
    }) => {
      const testUser = testUsers.alice;

      // Sign in first
      await signIn(page, testUser.email, testUser.password);

      // Try to access protected route
      await page.goto('/dashboard');

      // Should stay on dashboard
      expect(page.url()).toContain('/dashboard');
      await expect(page.locator('text=My Trips')).toBeVisible();
    });
  });

  test.describe('Session Persistence', () => {
    test('should maintain session across page reloads', async ({ page }) => {
      const testUser = testUsers.alice;

      // Sign in
      await signIn(page, testUser.email, testUser.password);

      // Reload page
      await page.reload();

      // Should still be authenticated
      expect(await isAuthenticated(page)).toBe(true);
    });
  });
});
