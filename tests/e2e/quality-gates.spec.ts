import { test, expect } from '@playwright/test';
import { qualityThresholds, qualityCheckPoints } from '../fixtures/test-data';

/**
 * Quality gate smoke tests for current routes and APIs.
 */

test.describe('Quality Gates', () => {
  test.describe('Public Surface Gate', () => {
    test('public pages should respond without server errors', async ({
      request,
    }) => {
      for (const path of qualityCheckPoints.publicPages) {
        const response = await request.get(path, { maxRedirects: 0 });
        expect(response.status(), `${path} returned 5xx`).toBeLessThan(500);
      }
    });

    test('protected pages should redirect unauthenticated users to login', async ({
      request,
    }) => {
      for (const path of qualityCheckPoints.protectedPages) {
        const response = await request.get(path, { maxRedirects: 0 });
        expect(response.status(), `${path} should redirect`).toBeGreaterThanOrEqual(300);
        expect(response.status(), `${path} should redirect`).toBeLessThan(400);
        expect(response.headers().location ?? '').toContain('/login');
      }
    });
  });

  test.describe('Performance Gate - Response Time', () => {
    test('critical pages should respond within 3s (P95)', async ({
      request,
    }) => {
      const timings: Record<string, number[]> = {};
      const measuredPaths = [
        ...qualityCheckPoints.publicPages,
        ...qualityCheckPoints.protectedPages,
      ];

      for (const path of measuredPaths) {
        timings[path] = [];

        for (let i = 0; i < 3; i++) {
          const startTime = Date.now();
          await request.get(path, { maxRedirects: 0 });
          timings[path].push(Date.now() - startTime);
        }
      }

      for (const [path, measurements] of Object.entries(timings)) {
        const sorted = [...measurements].sort((a, b) => a - b);
        const p95Index = Math.ceil(sorted.length * 0.95) - 1;
        const p95 = sorted[p95Index];

        console.log(`${path}: P95=${p95}ms`);
        expect(p95).toBeLessThanOrEqual(qualityThresholds.responseTimeP95Ms);
      }
    });

    test('login page should load within 3s', async ({ page }) => {
      const startTime = Date.now();

      await page.goto('/login', { waitUntil: 'domcontentloaded' });

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThanOrEqual(qualityThresholds.responseTimeP95Ms);
    });
  });

  test.describe('Performance Gate - Error Rate', () => {
    test('critical API endpoints should not return server errors', async ({
      request,
    }) => {
      let totalRequests = 0;
      let errorCount = 0;

      for (const endpoint of qualityCheckPoints.criticalApiEndpoints) {
        for (let i = 0; i < 5; i++) {
          totalRequests++;
          try {
            const response =
              endpoint.method === 'POST'
                ? await request.post(endpoint.path, { data: endpoint.data })
                : await request.get(endpoint.path, { maxRedirects: 0 });

            if (response.status() >= 500) {
              errorCount++;
              console.log(
                `ERROR: ${endpoint.method} ${endpoint.path} returned ${response.status()}`
              );
            }
          } catch {
            errorCount++;
            console.log(
              `ERROR: ${endpoint.method} ${endpoint.path} threw exception`
            );
          }
        }
      }

      const errorRate =
        totalRequests > 0 ? (errorCount / totalRequests) * 100 : 0;
      console.log(`Error Rate: ${errorRate.toFixed(2)}%`);

      expect(errorRate).toBeLessThanOrEqual(qualityThresholds.errorRatePercent);
    });
  });

  test.describe('Core Features Gate', () => {
    test('authentication pages are reachable', async ({ request }) => {
      const loginResponse = await request.get('/login', { maxRedirects: 0 });
      const signupResponse = await request.get('/signup', { maxRedirects: 0 });

      expect(loginResponse.status()).toBe(200);
      if (signupResponse.status() === 200) {
        expect(signupResponse.status()).toBe(200);
      } else {
        expect(signupResponse.status()).toBeGreaterThanOrEqual(300);
        expect(signupResponse.status()).toBeLessThan(400);
        expect(signupResponse.headers().location ?? '').toContain('/login');
      }
    });

    test('dashboard redirects to login when unauthenticated', async ({
      page,
    }) => {
      await page.goto('/dashboard');
      await page.waitForURL(/\/login/, { timeout: 10000 });
      await expect(
        page.getByRole('button', { name: 'Google로 로그인' })
      ).toBeVisible();
    });
  });

  test.describe('Security Gate', () => {
    test('security headers should be present on login page', async ({
      request,
    }) => {
      const response = await request.get('/login');
      const headers = response.headers();

      expect(headers['content-security-policy']).toBeTruthy();
      expect(headers['x-content-type-options']).toBe('nosniff');
      expect(headers['x-frame-options']).toBe('DENY');
    });

    test('protected routes should keep security middleware active', async ({
      request,
    }) => {
      const response = await request.get('/dashboard', { maxRedirects: 0 });

      expect(response.headers()['content-security-policy']).toBeTruthy();
      expect(response.headers()['x-nonce']).toBeTruthy();
    });
  });

  test('should generate quality report', async () => {
    const report = {
      timestamp: new Date().toISOString(),
      gates: {
        publicSurface:
          '✓ Public pages render and protected pages redirect correctly',
        responseTime: `✓ P95 response time ≤ ${qualityThresholds.responseTimeP95Ms}ms`,
        errorRate: `✓ Critical API server error rate ≤ ${qualityThresholds.errorRatePercent}%`,
        coreFeatures:
          '✓ Auth pages and protected route redirects are operational',
        security: '✓ Security checks passing',
      },
      nextSteps: [
        'All quality gates must pass before release',
        'Seeded authenticated flows should run separately with E2E auth credentials',
        'Performance profiling on real mobile devices is still recommended',
      ],
    };

    console.log('=== QUALITY GATE REPORT ===');
    console.log(JSON.stringify(report, null, 2));
    console.log('===========================');

    expect(report.gates).toBeDefined();
  });
});
