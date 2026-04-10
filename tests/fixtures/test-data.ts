/**
 * Test data fixtures for E2E tests.
 */

export const testUsers = {
  alice: {
    email: 'test-alice@triplan.test',
    password: 'TestPassword123!@#',
    name: 'Alice Tester',
  },
  bob: {
    email: 'test-bob@triplan.test',
    password: 'TestPassword456!@#',
    name: 'Bob Collaborator',
  },
};

export const qualityThresholds = {
  responseTimeP95Ms: 3000,
  errorRatePercent: 1,
  minTestCoverage: 80,
};

export const qualityCheckPoints = {
  publicPages: ['/', '/login', '/signup'],
  protectedPages: ['/dashboard', '/notifications', '/profile'],
  criticalApiEndpoints: [
    { method: 'GET', path: '/api/notifications' },
    { method: 'GET', path: '/api/weather?tripId=test-trip' },
    {
      method: 'GET',
      path: '/api/directions?origin=37.5665,126.9780&destination=37.5700,126.9768&mode=walking',
    },
    {
      method: 'POST',
      path: '/api/scrape',
      data: { url: 'https://example.com' },
    },
  ],
};
