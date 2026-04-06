/**
 * Test data fixtures for E2E tests
 * Generated test users, trips, and places for reproducible testing
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

export const testTrips = {
  tokyo: {
    title: 'Tokyo 3 Days',
    destination: 'Tokyo, Japan',
    startDate: new Date(2026, 4, 1), // May 1
    endDate: new Date(2026, 4, 3), // May 3
  },
  paris: {
    title: 'Paris Weekend',
    destination: 'Paris, France',
    startDate: new Date(2026, 5, 1), // June 1
    endDate: new Date(2026, 5, 2), // June 2
  },
};

export const testPlaces = {
  sensojiTemple: {
    name: 'Senso-ji Temple',
    address: '2 Chome-3-1 Asakusa, Taito Ward, Tokyo 111-0032, Japan',
    category: 'temple',
  },
  tokyoTower: {
    name: 'Tokyo Tower',
    address: '4 Chome-2-8 Shibakoen, Minato Ward, Tokyo 105-0011, Japan',
    category: 'landmark',
  },
  eiffelTower: {
    name: 'Eiffel Tower',
    address: '5 Avenue Anatole France, 75007 Paris, France',
    category: 'landmark',
  },
};

/**
 * Test quality metrics thresholds
 * Used to validate performance and error rates
 */
export const qualityThresholds = {
  responseTimeP95Ms: 3000, // 3 seconds
  errorRatePercent: 1, // 1%
  minTestCoverage: 80, // 80% for critical flows
};

/**
 * URL patterns for quality validation
 */
export const qualityCheckPoints = {
  // Price accuracy: chatbot responses must match DB
  chatbotPriceEndpoint: '/api/chat', // Endpoint that returns price info
  placesPriceEndpoint: '/api/places', // Source of truth for prices

  // Performance monitoring
  criticalApiEndpoints: [
    '/api/auth/sign-up',
    '/api/auth/sign-in',
    '/api/trips',
    '/api/places',
    '/api/schedules',
  ],
};
