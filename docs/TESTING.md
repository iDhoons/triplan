# Testing Strategy & Quality Gates

> **Owner**: QA Engineer
> **Last Updated**: 2026-03-20
> **Status**: Active

---

## Overview

This document outlines the testing strategy, quality gates, and automated test coverage for the Travel Planner project. All tests must pass before a release can be deployed.

## Quality Gates (Release Blockers)

These 5 gates must pass **100%** before any release:

| Gate | Requirement | Owner | Status |
|------|-------------|-------|--------|
| 🔒 **Price Accuracy** | Chatbot prices match DB 100% | QA Engineer | Critical |
| ⚡ **Response Time** | P95 ≤ 3 seconds | QA Engineer | Critical |
| 📊 **Error Rate** | < 1% on critical endpoints | QA Engineer | Critical |
| ✅ **Core Features** | Auth, trips, places, schedule working | QA Engineer | Critical |
| 🛡️ **Security** | No OWASP Top 10 vulnerabilities | QA Engineer | Critical |

## Test Structure

```
tests/
├── e2e/                          # End-to-end tests (Playwright)
│   ├── auth.spec.ts              # Authentication flows
│   ├── travel-flows.spec.ts       # Trip/place/schedule management
│   └── quality-gates.spec.ts      # Performance & accuracy validation
├── fixtures/
│   ├── test-data.ts              # Test users, trips, places
│   └── auth-helper.ts            # Reusable auth utilities
└── README.md                       # Test documentation
```

## Running Tests

### E2E Tests (Playwright)

```bash
# Run all E2E tests
pnpm test:e2e

# Run with HTML report
pnpm test:e2e:run

# Debug mode (interactive)
pnpm test:e2e:debug

# Run specific test file
pnpm test:e2e tests/e2e/auth.spec.ts

# Run specific test
pnpm test:e2e --grep "should allow new user to create account"

# Record a browser interaction and copy a locator
pnpm playwright:codegen

# Click an element and print locator, size, and style info
pnpm playwright:inspect
```

### Unit Tests (Vitest)

```bash
# Run all unit tests
pnpm test:run

# Watch mode
pnpm test

# Coverage report
pnpm test:coverage
```

### Quality Gate Validation

```bash
# Run only quality gate tests (required before release)
pnpm test:quality

# Full validation (unit + e2e + gates)
pnpm test:all
```

## Test Coverage by Feature

### 1. Authentication (auth.spec.ts)

**Tests:**
- ✅ Sign up flow (valid/invalid email, weak password)
- ✅ Sign in flow (correct/incorrect credentials)
- ✅ Sign out flow
- ✅ Protected routes (redirect to login if not authenticated)
- ✅ Session persistence (reload maintains auth)

**Coverage:**
- `src/app/(auth)/` routes
- `src/lib/supabase/middleware.ts`
- Auth guards in API routes

### 2. Core Travel Flows (travel-flows.spec.ts)

**Tests:**
- ✅ Create trip (valid/invalid data, date validation)
- ✅ Add place to trip (search, duplicate detection)
- ✅ Manage schedule (add items, reorder, timing)
- ✅ Manage checklist (add items, check off)
- ✅ Collaboration (invite members)

**Coverage:**
- Trip CRUD operations
- Place search & management
- Schedule/checklist operations
- Real-time collaboration features

### 3. Quality Gates (quality-gates.spec.ts)

**Gate 1: Price Accuracy**
- Compares chatbot responses against DB source of truth
- Detects price hallucinations
- Ensures consistency across APIs

**Gate 2: Response Time (P95 ≤ 3s)**
- Measures critical API endpoint latency
- Dashboard load time validation
- Identifies bottlenecks

**Gate 3: Error Rate (< 1%)**
- Monitors 5xx errors on critical endpoints
- Tracks exception rates
- Alerts on degradation

**Gate 4: Core Features**
- Auth system operational
- Database connectivity
- Realtime updates enabled

**Gate 5: Security**
- HTTPS enforcement (production)
- Security headers present
- XSS vulnerability testing

## CI/CD Integration

### GitHub Actions Pipeline

Tests run on:
1. **Every PR** → `pnpm test:all` (unit + e2e)
2. **Before Merge** → Quality gates must pass
3. **Pre-deployment** → Full regression suite

```yaml
# .github/workflows/test.yml
- name: Run unit tests
  run: pnpm test:run

- name: Run E2E tests
  run: pnpm test:e2e:run

- name: Verify quality gates
  run: pnpm test:quality
```

## Test Data Management

### Test Users

```typescript
// From tests/fixtures/test-data.ts
testUsers.alice = { email: 'test-alice@triplan.test', ... }
testUsers.bob = { email: 'test-bob@triplan.test', ... }
```

**Reset Strategy:**
- Unique timestamps in email to avoid collisions
- Clean up test data daily
- Separate test tenant in Supabase (recommended)

### Test Trips & Places

Pre-defined test data in `tests/fixtures/test-data.ts`:
- `testTrips.tokyo` — 3-day trip
- `testTrips.paris` — weekend trip
- `testPlaces.sensojiTemple`, `tokyoTower`, etc.

## Writing New Tests

### Pattern: E2E Test Template

```typescript
import { test, expect } from '@playwright/test';
import { signIn } from '../fixtures/auth-helper';

test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    // Setup: sign in, navigate to page, etc.
    await signIn(page, email, password);
  });

  test('should do something specific', async ({ page }) => {
    // Arrange: find elements
    const element = page.locator('role=button[name="Click"]');

    // Act: perform action
    await element.click();

    // Assert: verify result
    await expect(page.locator('text=Success')).toBeVisible();
  });
});
```

### Locator Best Practices

1. **Prefer semantic selectors:**
   ```typescript
   // ✅ Good
   page.locator('button:has-text("Submit")');
   page.locator('role=textbox[name="Email"]');

   // ❌ Avoid
   page.locator('.btn.primary');  // fragile
   page.locator('div:nth-of-type(3)');  // brittle
   ```

2. **Use data-testid for complex UI:**
   ```typescript
   // In component: <div data-testid="schedule-item">
   page.locator('[data-testid="schedule-item"]');
   ```

3. **Wait for conditions:**
   ```typescript
   await expect(element).toBeVisible();
   await page.waitForURL('/dashboard');
   ```

### Browser-to-Locator Workflow

Use the code generator when you want to click a real element in the browser and copy a resilient locator back into code:

```bash
# Open codegen against the local app
pnpm playwright:codegen

# Or point it at a different URL
pnpm playwright:codegen http://localhost:5173
```

The generated locator should usually be narrowed toward `getByRole`, `getByLabel`, or `getByTestId` before it lands in a test or automation script.

Use the inspector when you want to identify one specific element for a Codex/Claude prompt:

```bash
pnpm pwi
```

The inspector chooses an available local port by default, starts this project's dev server there, and opens a browser. In the opened browser, `Option/Alt-click` the target element. The terminal prints a recommended locator, fallback locator options, element dimensions, and key computed styles. Paste the prompt snippet into the CLI, then add the requested change. Close the inspect tab or browser window when you want to stop the session.

You can also target a specific running server:

```bash
pnpm pwi 5173
pnpm pwi localhost:5173
pnpm pwi http://localhost:5173 --no-server
pnpm pwi --profile google-login
pnpm pwi --bundled
pnpm pwi --profiles
pnpm pwi:profiles
PLAYWRIGHT_INSPECT_PORT=5173 pnpm playwright:inspect
PLAYWRIGHT_INSPECT_URL=http://localhost:5173 pnpm playwright:inspect
```

`pwi` uses Chrome channel by default and stores persistent browser profiles under `.playwright-pwi/`. The default profile name is the current folder name, so each worktree gets its own browser state label. Cookies and local storage survive across runs for the same profile and origin. Override the label when you need a separate login state:

```bash
pnpm pwi --profile personal
pnpm pwi --profile test-user
```

If the same profile is opened on a different origin, for example a different localhost port, `pwi` prints a warning. Cookies may survive across localhost ports, but `localStorage` and `sessionStorage` are origin-specific; use a fixed port for the most predictable login state.

To inspect saved profile labels and their last opened origins:

```bash
pnpm pwi:profiles
```

## Performance Monitoring

### Key Metrics

| Metric | Target | Tool |
|--------|--------|------|
| First Contentful Paint (FCP) | < 2s | Lighthouse |
| Time to Interactive (TTI) | < 3s | Playwright |
| API Response Time (P95) | < 3s | Quality gates |
| Error Rate | < 1% | Quality gates |

### Running Performance Tests

```bash
# Lighthouse audit
pnpm build && pnpm start
# Then run: npx lighthouse http://localhost:3000

# Playwright performance measurements
pnpm test:e2e tests/e2e/quality-gates.spec.ts --reporter=list
```

## Known Issues & Workarounds

| Issue | Impact | Workaround |
|-------|--------|-----------|
| Flaky date picker tests | Medium | Use fixed dates, avoid system date |
| Google Maps API rate limiting | Low | Use mock responses in test env |
| Realtime subscription delays | Low | Add explicit waits (500ms) |

## Release Checklist

Before deploying to production:

- [ ] All unit tests passing (`pnpm test:run`)
- [ ] All E2E tests passing (`pnpm test:e2e:run`)
- [ ] Quality gates passing (`pnpm test:quality`)
- [ ] Error rate < 1% in staging
- [ ] P95 response time < 3s
- [ ] Price accuracy 100% match
- [ ] No security warnings in scan
- [ ] Manual smoke test of critical flows

## Contact & Escalation

**QA Engineer** (test owner)
- Primary: E2E test failures, quality gate blockers
- Escalation: CTO if release gate fails
- Reports: Weekly test summary to team

## Future Enhancements

- [ ] Load testing (concurrent user simulation)
- [ ] API contract testing
- [ ] Visual regression testing
- [ ] Performance budgets in CI/CD
- [ ] Custom quality metrics dashboard
- [ ] Mobile-specific test suite
