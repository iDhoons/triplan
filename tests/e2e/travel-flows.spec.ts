import { test, expect } from '@playwright/test';
import { signIn, signOut } from '../fixtures/auth-helper';
import { testUsers, testTrips, testPlaces } from '../fixtures/test-data';

/**
 * Core Travel Planning Flow E2E Tests
 * Critical user journeys for trip creation and management
 */

test.describe('Travel Planning Flows', () => {
  test.beforeEach(async ({ page }) => {
    // Sign in before each test
    const testUser = testUsers.alice;
    await signIn(page, testUser.email, testUser.password);
  });

  test.afterEach(async ({ page }) => {
    // Clean up
    await signOut(page);
  });

  test.describe('Create Trip', () => {
    test('should create a new trip with valid data', async ({ page }) => {
      // Navigate to trips page
      await page.goto('/dashboard');

      // Click create new trip button
      await page.click('button:has-text("New Trip")');

      // Fill trip form
      const tripData = testTrips.tokyo;
      await page.fill('input[placeholder*="Title"]', tripData.title);
      await page.fill('input[placeholder*="Destination"]', tripData.destination);

      // Set dates
      await page.fill('input[type="date"][name*="start"]', '2026-05-01');
      await page.fill('input[type="date"][name*="end"]', '2026-05-03');

      // Submit form
      await page.click('button:has-text("Create")');

      // Should navigate to trip detail page
      await page.waitForURL(/\/trips\/[a-z0-9-]+/, { timeout: 10000 });

      // Verify trip appears in the UI
      await expect(page.locator(`text=${tripData.title}`)).toBeVisible();
    });

    test('should show validation error for missing title', async ({ page }) => {
      await page.goto('/dashboard');
      await page.click('button:has-text("New Trip")');

      // Fill only destination
      await page.fill(
        'input[placeholder*="Destination"]',
        testTrips.tokyo.destination
      );

      // Try to submit without title
      await page.click('button:has-text("Create")');

      // Check for error
      await expect(page.locator('text=/title|required/i')).toBeVisible();
    });

    test('should show validation error for invalid date range', async ({
      page,
    }) => {
      await page.goto('/dashboard');
      await page.click('button:has-text("New Trip")');

      // Fill form
      await page.fill('input[placeholder*="Title"]', 'Test Trip');
      await page.fill('input[placeholder*="Destination"]', 'Tokyo, Japan');

      // Set invalid date range (end before start)
      await page.fill('input[type="date"][name*="start"]', '2026-05-03');
      await page.fill('input[type="date"][name*="end"]', '2026-05-01');

      // Try to submit
      await page.click('button:has-text("Create")');

      // Check for error
      await expect(
        page.locator('text=/end date|after|invalid/i')
      ).toBeVisible();
    });
  });

  test.describe('Add Place to Trip', () => {
    test('should add a place to trip schedule', async ({ page }) => {
      // Navigate to an existing trip (assumes trip exists)
      await page.goto('/dashboard');

      // Click on a trip
      const tripLink = page.locator('a:has-text("Tokyo")').first();
      if (await tripLink.isVisible()) {
        await tripLink.click();
      } else {
        // Create a trip if none exists
        await page.click('button:has-text("New Trip")');
        await page.fill('input[placeholder*="Title"]', 'Test Trip');
        await page.fill('input[placeholder*="Destination"]', 'Tokyo, Japan');
        await page.fill('input[type="date"][name*="start"]', '2026-05-01');
        await page.fill('input[type="date"][name*="end"]', '2026-05-03');
        await page.click('button:has-text("Create")');
        await page.waitForURL(/\/trips\/[a-z0-9-]+/);
      }

      // Click add place button
      await page.click('button:has-text("Add Place")');

      // Search for a place
      const placeData = testPlaces.sensojiTemple;
      await page.fill('input[placeholder*="search|place"]', placeData.name);

      // Wait for search results
      await expect(page.locator(`text=${placeData.name}`)).toBeVisible({
        timeout: 5000,
      });

      // Click on search result
      await page.click(`text=${placeData.name}`);

      // Should add to trip
      await expect(page.locator(`text=${placeData.name}`)).toBeVisible();
    });

    test('should show error when adding duplicate place', async ({ page }) => {
      // Navigate to trip
      await page.goto('/dashboard');
      const tripLink = page.locator('a:has-text("Tokyo")').first();
      if (await tripLink.isVisible()) {
        await tripLink.click();
      }

      // Add first place
      await page.click('button:has-text("Add Place")');
      await page.fill('input[placeholder*="search|place"]', 'Senso-ji Temple');
      await page.click('text=Senso-ji Temple');

      // Try to add same place again
      await page.click('button:has-text("Add Place")');
      await page.fill('input[placeholder*="search|place"]', 'Senso-ji Temple');
      await page.click('text=Senso-ji Temple');

      // Should show duplicate error
      await expect(
        page.locator('text=/already|duplicate|added/i')
      ).toBeVisible();
    });
  });

  test.describe('Schedule Management', () => {
    test('should add item to daily schedule', async ({ page }) => {
      // Navigate to trip with schedule
      await page.goto('/dashboard');
      const tripLink = page.locator('a:has-text("Tokyo")').first();
      if (await tripLink.isVisible()) {
        await tripLink.click();
      }

      // Navigate to schedule tab
      await page.click('text=Schedule');

      // Click on a day
      await page.click('button:has-text("Day 1")');

      // Click add schedule item
      await page.click('button:has-text("Add Activity")');

      // Fill in details
      await page.fill('input[placeholder*="Activity|Title"]', 'Visit Temple');
      await page.fill(
        'input[type="time"]',
        '09:00' // morning time
      );

      // Submit
      await page.click('button:has-text("Add")');

      // Verify item appears
      await expect(page.locator('text=Visit Temple')).toBeVisible();
    });

    test('should reorder schedule items via drag-and-drop', async ({
      page,
    }) => {
      // Navigate to trip schedule
      await page.goto('/dashboard');
      const tripLink = page.locator('a:has-text("Tokyo")').first();
      if (await tripLink.isVisible()) {
        await tripLink.click();
        await page.click('text=Schedule');
      }

      // Find schedule items (assumes multiple exist)
      const items = page.locator('[data-testid="schedule-item"]');
      const count = await items.count();

      if (count >= 2) {
        // Drag first item below second
        const firstItem = items.nth(0);
        const secondItem = items.nth(1);

        await firstItem.dragTo(secondItem);

        // Verify order changed
        const newFirstItem = items.nth(0);
        const firstItemText = await newFirstItem.textContent();
        expect(firstItemText).not.toContain('Visit Temple');
      }
    });
  });

  test.describe('Checklist Management', () => {
    test('should add item to trip checklist', async ({ page }) => {
      // Navigate to trip
      await page.goto('/dashboard');
      const tripLink = page.locator('a:has-text("Tokyo")').first();
      if (await tripLink.isVisible()) {
        await tripLink.click();
      }

      // Navigate to checklist tab
      await page.click('text=Checklist');

      // Add new category if needed
      const addCategoryBtn = page.locator('button:has-text("Add Category")');
      if (await addCategoryBtn.isVisible()) {
        await addCategoryBtn.click();
        await page.fill('input[placeholder*="Category"]', 'Documents');
        await page.click('button:has-text("Add")');
      }

      // Add item to category
      await page.click('button:has-text("Add Item")');
      await page.fill('input[placeholder*="Item"]', 'Passport');
      await page.click('button:has-text("Add")');

      // Verify item appears
      await expect(page.locator('text=Passport')).toBeVisible();
    });

    test('should check off checklist item', async ({ page }) => {
      // Navigate to trip checklist
      await page.goto('/dashboard');
      const tripLink = page.locator('a:has-text("Tokyo")').first();
      if (await tripLink.isVisible()) {
        await tripLink.click();
        await page.click('text=Checklist');
      }

      // Find a checklist item
      const checkboxes = page.locator('input[type="checkbox"]');
      if (await checkboxes.count() > 0) {
        // Click first checkbox
        await checkboxes.first().click();

        // Verify it's checked
        await expect(checkboxes.first()).toBeChecked();
      }
    });
  });

  test.describe('Trip Collaboration', () => {
    test('should invite member to trip', async ({ page }) => {
      // Navigate to trip
      await page.goto('/dashboard');
      const tripLink = page.locator('a:has-text("Tokyo")').first();
      if (await tripLink.isVisible()) {
        await tripLink.click();
      }

      // Click members tab
      await page.click('text=Members');

      // Click invite member button
      await page.click('button:has-text("Invite")');

      // Enter collaborator email
      await page.fill(
        'input[placeholder*="email"]',
        testUsers.bob.email
      );

      // Submit invite
      await page.click('button:has-text("Send Invite")');

      // Verify invite sent
      await expect(
        page.locator(`text=${testUsers.bob.email}`)
      ).toBeVisible();
    });
  });
});
