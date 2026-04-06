# Test Automation Framework

Travel Planner automated testing infrastructure.

## Quick Start

```bash
# Run all tests
pnpm test:all

# Run only E2E tests
pnpm test:e2e:run

# Run in debug mode
pnpm test:e2e:debug
```

## Directory Structure

```
tests/
├── e2e/                    # End-to-end tests (Playwright)
│   ├── auth.spec.ts        # Authentication flows
│   ├── travel-flows.spec.ts # Trip/place/schedule management
│   └── quality-gates.spec.ts # Performance & accuracy gates
└── fixtures/               # Test utilities & data
    ├── test-data.ts        # Test users, trips, places
    └── auth-helper.ts      # Reusable auth functions
```

## Test Types

### E2E Tests (Playwright)

Full user journey testing across critical flows:

- **Auth**: Sign up, sign in, sign out, session persistence
- **Trips**: Create, view, delete trips
- **Places**: Search, add, remove places
- **Schedule**: Add activities, reorder by drag-and-drop
- **Checklist**: Add items, track progress
- **Collaboration**: Invite members, real-time sync

### Quality Gates

Automated verification of release requirements:

1. **Price Accuracy** — Chatbot responses match DB 100%
2. **Performance** — Response time P95 ≤ 3 seconds
3. **Reliability** — Error rate < 1% on critical paths
4. **Features** — All core features operational
5. **Security** — No OWASP Top 10 vulnerabilities

## Key Files

| File | Purpose |
|------|---------|
| `playwright.config.ts` | Playwright configuration (browsers, timeouts, reporters) |
| `tests/e2e/*.spec.ts` | Test suites (authentication, flows, quality gates) |
| `tests/fixtures/test-data.ts` | Test users, trips, places, and metrics |
| `tests/fixtures/auth-helper.ts` | Reusable authentication utilities |
| `docs/TESTING.md` | Full testing strategy & documentation |

## Running Tests

### All Tests

```bash
pnpm test:all      # Unit + E2E + quality gates
```

### Unit Tests Only

```bash
pnpm test          # Watch mode
pnpm test:run      # Single run
pnpm test:coverage # With coverage report
```

### E2E Tests

```bash
pnpm test:e2e      # Run all E2E tests
pnpm test:e2e:run  # Run with HTML report
pnpm test:e2e:ui   # Interactive UI mode
pnpm test:e2e:debug # Debug mode (step through tests)
```

### Quality Gates

```bash
pnpm test:quality  # Run only quality gate validation
```

## Test Data

### Test Users

Pre-configured test users in `tests/fixtures/test-data.ts`:

```typescript
testUsers.alice // alice@triplan.test
testUsers.bob   // bob@triplan.test
```

New users are created with unique emails using timestamps to avoid collisions.

### Test Trips & Places

Pre-defined test data for consistent scenarios:

- **Tokyo Trip** (3 days)
- **Paris Trip** (weekend)
- **Temples, towers, landmarks** for place testing

## Writing Tests

### Simple Pattern

```typescript
import { test, expect } from '@playwright/test';
import { signIn } from '../fixtures/auth-helper';

test('user can create a trip', async ({ page }) => {
  await signIn(page, 'user@test.com', 'password');

  await page.goto('/dashboard');
  await page.click('button:has-text("New Trip")');

  await expect(page.locator('text=New Trip')).toBeVisible();
});
```

### Using Helpers

```typescript
// Use auth helper for sign in
import { signIn, signOut, isAuthenticated } from '../fixtures/auth-helper';

await signIn(page, email, password);
const authenticated = await isAuthenticated(page);
```

### Locator Best Practices

```typescript
// ✅ Prefer semantic selectors
page.locator('button:has-text("Submit")')
page.locator('role=textbox[name="Email"]')

// ❌ Avoid CSS selectors (fragile)
page.locator('.btn.primary')
page.locator('div:nth-of-type(3)')

// Use data-testid for complex UI
page.locator('[data-testid="schedule-item"]')
```

## Continuous Integration

Tests run automatically on:

- **Every PR** → All tests must pass
- **Before merge** → Quality gates verified
- **Pre-deployment** → Full regression suite

Results are posted to PR with HTML reports available as artifacts.

## Performance

Test execution times (approximate):

- Unit tests: ~10 seconds
- E2E tests: ~3 minutes (parallel run)
- Quality gates: ~5 minutes (includes timing measurements)
- Full suite: ~8 minutes

## Debugging

### Interactive Debug Mode

```bash
pnpm test:e2e:debug
```

Step through tests with pause/resume in Playwright Inspector.

### UI Mode

```bash
pnpm test:e2e:ui
```

Watch tests run in real-time with detailed trace inspection.

### Console Logging

```typescript
// In tests
console.log('Debug info:', value);

// View in test output
// Run: pnpm test:e2e --reporter=list
```

### Screenshots & Traces

Tests automatically capture:
- Screenshots on failure
- Trace recordings (inputs, network, screenshots)

Found in `playwright-report/` after test run.

## Common Issues

| Issue | Solution |
|-------|----------|
| Tests timeout | Increase timeout in playwright.config.ts |
| Flaky tests | Add explicit waits, avoid system date |
| DB not ready | Wait for Supabase to initialize |
| API auth issues | Use valid test credentials from test-data.ts |

## Maintenance

### Update Test Data

Edit `tests/fixtures/test-data.ts` when:
- Test users change
- Trip/place data updates
- Quality thresholds adjust

### Add New Test Suites

1. Create `tests/e2e/feature.spec.ts`
2. Import helpers from `tests/fixtures/`
3. Use `test.describe()` for organization
4. Run: `pnpm test:e2e tests/e2e/feature.spec.ts`

### Update Quality Thresholds

Edit `tests/fixtures/test-data.ts` → `qualityThresholds`

## Contact

**QA Engineer** — owns all test infrastructure
- Test failures or questions → contact QA
- Release blockers → escalate to CTO

---

**For full testing strategy, see [docs/TESTING.md](../docs/TESTING.md)**
