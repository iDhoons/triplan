import { defineConfig, devices } from '@playwright/test';

const DEFAULT_E2E_WEB_SERVER_COMMAND =
  'NODE_OPTIONS=--max-old-space-size=4096 pnpm exec next dev --webpack';
const webServerCommand =
  process.env.PLAYWRIGHT_WEB_SERVER_COMMAND ?? DEFAULT_E2E_WEB_SERVER_COMMAND;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
  ],

  use: {
    baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  webServer: {
    // E2E 기본 경로는 webpack dev server로 고정한다.
    command: webServerCommand,
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],

  timeout: 60 * 1000,
  globalTimeout: 30 * 60 * 1000,
});
