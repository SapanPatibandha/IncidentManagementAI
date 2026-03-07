---
name: testing-standards
description: >
  Testing standards and patterns for the Incident Management AI system.
  ALWAYS use this skill when writing any test — unit, integration, E2E, or API tests.
  Trigger on any mention of: test, spec, vitest, playwright, supertest, mock, stub,
  coverage, assertion, test suite, TDD, integration test, E2E, end-to-end, test file,
  describe, it, expect, beforeEach, afterEach, or any request to "add tests" to any
  service or component. This skill defines the authoritative testing strategy — all
  generated test code must conform to the patterns, tools, and coverage rules here.
---

# Incident Management AI — Testing Standards Skill

This is the **authoritative testing reference** for all services and the React frontend.
Read this before writing any test file.

> **Always read alongside:**
> - `incident-management-srs` — for business rules that must be tested
> - `event-sourcing` — for aggregate testing patterns
> - `incident-management-architecture` — for service boundaries

---

## Quick Reference

| Layer              | Tool                          | Location                   | Run command              |
|--------------------|-------------------------------|----------------------------|--------------------------|
| Unit (backend)     | Vitest                        | `src/**/*.unit.test.ts`    | `vitest run`             |
| Integration (API)  | Vitest + Supertest            | `tests/integration/*.test.ts` | `vitest run --config vitest.integration.ts` |
| Unit (frontend)    | Vitest + React Testing Library| `src/**/*.test.tsx`        | `vitest run`             |
| E2E                | Playwright                    | `tests/e2e/*.spec.ts`      | `playwright test`        |
| Coverage threshold | Vitest (v8)                   | All                        | `vitest run --coverage`  |

---

## Coverage Thresholds (enforced in CI)

```typescript
// vitest.config.ts (all backend services)
coverage: {
  provider: 'v8',
  thresholds: {
    lines:     80,
    functions: 80,
    branches:  75,
    statements: 80,
  },
  exclude: ['src/main.ts', 'src/config/**', '**/*.d.ts'],
}
```

---

## Backend Testing Strategy

### Layer 1 — Domain / Aggregate Unit Tests (most important)

Aggregates are **pure functions** — test them with zero infrastructure.
No database, no RabbitMQ, no HTTP. Just commands in, events out.

```typescript
// incident-service/src/domain/aggregates/IncidentAggregate.unit.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { IncidentAggregate } from './IncidentAggregate';
import { CreateIncident, TransitionStatus } from '../commands';

describe('IncidentAggregate', () => {

  describe('CreateIncident command', () => {
    it('emits IncidentCreated with correct payload', () => {
      const aggregate = new IncidentAggregate();
      const events = aggregate.handle(new CreateIncident({
        incidentId: 'uuid-1',
        title: 'Login page 500 error',
        description: 'Detailed description here',
        priority: 'High',
        creatorId: 'user-1',
      }));

      expect(events).toHaveLength(1);
      expect(events[0].eventType).toBe('IncidentCreated');
      expect(events[0].payload.status).toBe('Open');
      expect(events[0].payload.creatorId).toBe('user-1');
    });
  });

  describe('Status transitions', () => {
    let aggregate: IncidentAggregate;

    beforeEach(() => {
      // Rehydrate aggregate from known events
      aggregate = IncidentAggregate.rehydrate([
        createEvent('IncidentCreated', { status: 'Open', creatorId: 'user-1', assigneeId: 'responder-1' }),
      ]);
    });

    it('allows Responder to move Open → In-Process', () => {
      const events = aggregate.handle(new TransitionStatus({
        toStatus: 'In-Process',
        actorId: 'responder-1',
        actorRole: 'IssueResponder',
      }));
      expect(events[0].eventType).toBe('IncidentStatusChanged');
      expect(events[0].payload.toStatus).toBe('In-Process');
    });

    it('rejects Creator moving Open → In-Process', () => {
      expect(() =>
        aggregate.handle(new TransitionStatus({
          toStatus: 'In-Process',
          actorId: 'user-1',
          actorRole: 'IncidentCreator',
        }))
      ).toThrow('IncidentCreator cannot transition from Open to In-Process');
    });

    it('rejects invalid transition Open → Closed when responder has started', () => {
      // Rehydrate with In-Process state
      const inProcessAggregate = IncidentAggregate.rehydrate([
        createEvent('IncidentCreated', { status: 'Open', creatorId: 'user-1' }),
        createEvent('IncidentStatusChanged', { fromStatus: 'Open', toStatus: 'In-Process' }),
      ]);
      expect(() =>
        inProcessAggregate.handle(new TransitionStatus({
          toStatus: 'Closed',
          actorId: 'user-1',
          actorRole: 'IncidentCreator',
          // Creator cannot close from In-Process directly — must wait for resolution
        }))
      ).toThrow();
    });
  });

  // Helper — build minimal valid events for rehydration
  function createEvent(eventType: string, payload: Record<string, unknown>) {
    return { eventId: crypto.randomUUID(), eventType, eventVersion: 1,
             aggregateId: 'inc-1', aggregateType: 'Incident',
             occurredAt: new Date().toISOString(), payload };
  }
});
```

**What to always test in aggregates:**
- [ ] Every valid command emits the correct event(s)
- [ ] Every invalid command throws with a descriptive message
- [ ] All SRS status transition rules (all paths in the state machine)
- [ ] Rehydration from events restores correct state
- [ ] Aggregate rejects commands from wrong roles

---

### Layer 2 — Command Handler Unit Tests

Test the orchestration logic: load aggregate → handle command → save events.
Mock the event store and publisher.

```typescript
// CreateIncidentHandler.unit.test.ts
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { CreateIncidentHandler } from './CreateIncidentHandler';

describe('CreateIncidentHandler', () => {
  const mockEventStore = { append: vi.fn(), load: vi.fn().mockResolvedValue([]) };
  const mockPublisher  = { publish: vi.fn() };
  let handler: CreateIncidentHandler;

  beforeEach(() => {
    vi.clearAllMocks();
    handler = new CreateIncidentHandler(mockEventStore, mockPublisher);
  });

  it('saves events to event store and publishes them', async () => {
    await handler.execute({ incidentId: 'uuid-1', title: 'Test', description: 'Desc x20 chars', priority: 'High', creatorId: 'user-1' });

    expect(mockEventStore.append).toHaveBeenCalledOnce();
    expect(mockPublisher.publish).toHaveBeenCalledOnce();
    const savedEvent = mockEventStore.append.mock.calls[0][0][0];
    expect(savedEvent.eventType).toBe('IncidentCreated');
  });

  it('does not publish if event store save fails', async () => {
    mockEventStore.append.mockRejectedValue(new Error('DB error'));
    await expect(handler.execute({ incidentId: 'uuid-1', title: 'Test', description: 'Desc x20 chars', priority: 'High', creatorId: 'user-1' }))
      .rejects.toThrow('DB error');
    expect(mockPublisher.publish).not.toHaveBeenCalled();
  });
});
```

---

### Layer 3 — API Integration Tests

Test full HTTP request → response cycle with real PostgreSQL + real RabbitMQ (via Docker).
Use `docker-compose.test.yml` to spin up dependencies.

```typescript
// tests/integration/incidents.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import { buildApp } from '../../src/app';

describe('Incident API — Integration', () => {
  let app: ReturnType<typeof buildApp>;
  let request: supertest.SuperTest<supertest.Test>;

  // JWT tokens for each role (pre-generated test tokens signed with test RSA key)
  const CREATOR_TOKEN  = process.env.TEST_CREATOR_TOKEN!;
  const RESPONDER_TOKEN = process.env.TEST_RESPONDER_TOKEN!;
  const ADMIN_TOKEN    = process.env.TEST_ADMIN_TOKEN!;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
    request = supertest(app.server);
  });

  afterAll(async () => { await app.close(); });

  describe('POST /incidents', () => {
    it('creates incident and returns 201', async () => {
      const res = await request
        .post('/incidents')
        .set('Authorization', `Bearer ${CREATOR_TOKEN}`)
        .send({ title: 'Test incident', description: 'A'.repeat(20), priority: 'High' });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('Open');
      expect(res.body.incidentId).toBeDefined();
    });

    it('returns 401 without token', async () => {
      const res = await request.post('/incidents').send({ title: 'Test', description: 'Desc', priority: 'High' });
      expect(res.status).toBe(401);
    });

    it('returns 403 when called by Responder', async () => {
      const res = await request
        .post('/incidents')
        .set('Authorization', `Bearer ${RESPONDER_TOKEN}`)
        .send({ title: 'Test', description: 'Desc x20 chars', priority: 'High' });
      expect(res.status).toBe(403);
    });
  });

  describe('Full lifecycle — create → assign → in-process → close', () => {
    it('completes full happy path', async () => {
      // 1. Creator creates incident
      const createRes = await request.post('/incidents')
        .set('Authorization', `Bearer ${CREATOR_TOKEN}`)
        .send({ title: 'Full lifecycle test', description: 'A'.repeat(20), priority: 'Medium' });
      const { incidentId } = createRes.body;
      expect(createRes.status).toBe(201);

      // 2. Admin assigns to responder
      const assignRes = await request.post(`/incidents/${incidentId}/assign`)
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send({ assigneeId: process.env.TEST_RESPONDER_ID });
      expect(assignRes.status).toBe(200);

      // 3. Responder moves to In-Process
      const inProcessRes = await request.patch(`/incidents/${incidentId}/status`)
        .set('Authorization', `Bearer ${RESPONDER_TOKEN}`)
        .send({ status: 'In-Process', comment: 'Starting work' });
      expect(inProcessRes.status).toBe(200);
      expect(inProcessRes.body.status).toBe('In-Process');

      // 4. Responder closes
      const closeRes = await request.patch(`/incidents/${incidentId}/status`)
        .set('Authorization', `Bearer ${RESPONDER_TOKEN}`)
        .send({ status: 'Closed', comment: 'Fixed in v1.2' });
      expect(closeRes.status).toBe(200);
      expect(closeRes.body.status).toBe('Closed');
    });
  });

  describe('Data isolation — Creator sees only own incidents', () => {
    it('returns 403 when Creator requests another Creator\'s incident', async () => {
      // Create incident as creator 1
      const createRes = await request.post('/incidents')
        .set('Authorization', `Bearer ${CREATOR_TOKEN}`)
        .send({ title: 'Private incident', description: 'A'.repeat(20), priority: 'Low' });
      const { incidentId } = createRes.body;

      // Try to fetch as creator 2 — must be 403
      const fetchRes = await request.get(`/incidents/${incidentId}`)
        .set('Authorization', `Bearer ${process.env.TEST_CREATOR2_TOKEN}`);
      expect(fetchRes.status).toBe(403);
    });
  });
});
```

---

### Integration Test Setup (`docker-compose.test.yml`)

```yaml
# infra/docker-compose.test.yml
services:
  postgres-test:
    image: postgres:16
    environment: { POSTGRES_DB: test_db, POSTGRES_USER: test, POSTGRES_PASSWORD: test }
    ports: ["5433:5432"]   # different port to avoid conflict with dev

  rabbitmq-test:
    image: rabbitmq:3
    ports: ["5673:5672"]
```

```typescript
// vitest.integration.ts
export default defineConfig({
  test: {
    include: ['tests/integration/**/*.test.ts'],
    globalSetup: './tests/integration/setup.ts',
    testTimeout: 30_000,
    hookTimeout: 30_000,
    poolOptions: { forks: { singleFork: true } },  // run sequentially — shared DB state
  }
});
```

```typescript
// tests/integration/setup.ts
export async function setup() {
  // Run migrations on test DB
  await runMigrations(process.env.TEST_DATABASE_URL!);
}
export async function teardown() {
  await cleanDatabase(process.env.TEST_DATABASE_URL!);
}
```

---

## Frontend Testing Strategy

### Layer 1 — Component Unit Tests (React Testing Library)

Test components in isolation. Mock all API hooks.

```typescript
// features/incidents/components/StatusBadge.test.tsx
import { render, screen } from '@testing-library/react';
import { StatusBadge } from './StatusBadge';

describe('StatusBadge', () => {
  it('renders Open status with amber styling', () => {
    render(<StatusBadge status="Open" />);
    const badge = screen.getByText('Open');
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain('amber');
  });

  it('renders all three statuses correctly', () => {
    const statuses = ['Open', 'In-Process', 'Closed'] as const;
    statuses.forEach(status => {
      const { unmount } = render(<StatusBadge status={status} />);
      expect(screen.getByText(status)).toBeInTheDocument();
      unmount();
    });
  });
});
```

### Layer 2 — Page / Feature Tests (with mocked hooks)

```typescript
// features/incidents/pages/IncidentListPage.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { IncidentListPage } from './IncidentListPage';
import * as hooks from '../hooks/useIncidents';

describe('IncidentListPage', () => {
  it('shows skeleton while loading', () => {
    vi.spyOn(hooks, 'useIncidents').mockReturnValue({ isLoading: true } as any);
    render(<IncidentListPage />);
    expect(screen.getByTestId('page-skeleton')).toBeInTheDocument();
  });

  it('shows empty state when no incidents', async () => {
    vi.spyOn(hooks, 'useIncidents').mockReturnValue({ isLoading: false, data: [], isError: false } as any);
    render(<IncidentListPage />);
    await waitFor(() => expect(screen.getByText('No incidents yet')).toBeInTheDocument());
  });

  it('renders incident rows when data exists', async () => {
    vi.spyOn(hooks, 'useIncidents').mockReturnValue({
      isLoading: false,
      isError: false,
      data: [{ incidentId: '1', title: 'Login bug', status: 'Open', priority: 'High' }],
    } as any);
    render(<IncidentListPage />);
    await waitFor(() => expect(screen.getByText('Login bug')).toBeInTheDocument());
  });
});
```

### Layer 3 — Form Tests

```typescript
// features/incidents/pages/CreateIncidentPage.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

describe('CreateIncidentPage — form validation', () => {
  it('shows validation error when title is too short', async () => {
    render(<CreateIncidentPage />);
    await userEvent.type(screen.getByLabelText('Title'), 'Hi');
    fireEvent.submit(screen.getByRole('button', { name: /create/i }));
    await waitFor(() =>
      expect(screen.getByText('Title must be at least 5 characters')).toBeInTheDocument()
    );
  });

  it('calls mutation on valid submission', async () => {
    const mockMutate = vi.fn();
    vi.spyOn(hooks, 'useCreateIncident').mockReturnValue({ mutate: mockMutate, isPending: false } as any);
    render(<CreateIncidentPage />);
    await userEvent.type(screen.getByLabelText('Title'), 'Valid title here');
    await userEvent.type(screen.getByLabelText('Description'), 'A'.repeat(25));
    fireEvent.submit(screen.getByRole('button', { name: /create/i }));
    await waitFor(() => expect(mockMutate).toHaveBeenCalledOnce());
  });
});
```

---

## E2E Tests (Playwright)

Test critical user journeys against the running full stack.

```typescript
// tests/e2e/incident-lifecycle.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Incident Creator journey', () => {

  test('can create and view an incident', async ({ page }) => {
    await page.goto('/login');
    // OAuth login — fill credentials in IdentityService login page
    await page.fill('[name=email]', process.env.E2E_CREATOR_EMAIL!);
    await page.fill('[name=password]', process.env.E2E_CREATOR_PASSWORD!);
    await page.click('[type=submit]');
    await page.waitForURL('/dashboard');

    // Create incident
    await page.click('text=New Incident');
    await page.fill('[name=title]', 'E2E test incident');
    await page.fill('[name=description]', 'This is a detailed description for the E2E test incident.');
    await page.selectOption('[name=priority]', 'High');
    await page.click('text=Create Incident');

    // Verify it appears in dashboard
    await page.waitForURL('/dashboard');
    await expect(page.locator('text=E2E test incident')).toBeVisible();
  });

});

test.describe('Data isolation', () => {
  test('Creator cannot access another creator\'s incident URL', async ({ page }) => {
    // Login as creator 2
    await loginAs(page, process.env.E2E_CREATOR2_EMAIL!, process.env.E2E_CREATOR2_PASSWORD!);
    // Navigate directly to creator 1's incident
    await page.goto(`/incidents/${process.env.E2E_CREATOR1_INCIDENT_ID}`);
    await expect(page.locator('text=Access denied')).toBeVisible();
  });
});

test.describe('Responder journey', () => {
  test('can see assigned incident and transition status', async ({ page }) => {
    await loginAs(page, process.env.E2E_RESPONDER_EMAIL!, process.env.E2E_RESPONDER_PASSWORD!);
    await page.goto('/queue');
    await expect(page.locator('[data-testid=incident-row]').first()).toBeVisible();
    await page.click('[data-testid=incident-row]');
    await page.click('text=Start Working');
    await expect(page.locator('text=In-Process')).toBeVisible();
  });
});

async function loginAs(page: any, email: string, password: string) {
  await page.goto('/login');
  await page.fill('[name=email]', email);
  await page.fill('[name=password]', password);
  await page.click('[type=submit]');
  await page.waitForURL(/dashboard|queue|admin/);
}
```

**Playwright config:**
```typescript
// playwright.config.ts
export default defineConfig({
  testDir: './tests/e2e',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'docker-compose up -d && npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
```

---

## What to Test Per Feature (Quick Checklist)

For every new feature/service, generate tests covering:

### Backend
- [ ] Aggregate: every valid command → correct event emitted
- [ ] Aggregate: every invalid command → throws with correct message
- [ ] Aggregate: all SRS status transition paths (draw the state machine, test every edge)
- [ ] Aggregate: rehydration from events restores state correctly
- [ ] Command Handler: happy path saves + publishes
- [ ] Command Handler: DB failure → does not publish
- [ ] API: 200/201 on valid request with correct role
- [ ] API: 401 without token
- [ ] API: 403 with wrong role
- [ ] API: 400 on invalid input (missing fields, bad data)
- [ ] API: 404 on non-existent resource
- [ ] Data isolation: user cannot access another user's data

### Frontend
- [ ] Component renders loading/error/empty states
- [ ] Form shows field-level validation errors
- [ ] Form calls mutation on valid submit
- [ ] Role guard redirects wrong role
- [ ] Status badge renders correct color for each status

### E2E
- [ ] Full happy path: login → create → assign → resolve
- [ ] Data isolation: cross-user access blocked
- [ ] Role redirect: each role lands on correct page after login

---

## Test File Naming Convention

```
src/domain/aggregates/IncidentAggregate.unit.test.ts   ← unit, co-located with source
src/application/command-handlers/CreateIncidentHandler.unit.test.ts
tests/integration/incidents.test.ts                     ← integration, separate folder
tests/e2e/incident-lifecycle.spec.ts                    ← E2E, separate folder
src/features/incidents/components/StatusBadge.test.tsx  ← frontend, co-located
```

---

## Test Environment Variables (`.env.test`)

```env
TEST_DATABASE_URL=postgresql://test:test@localhost:5433/test_db
TEST_RABBITMQ_URL=amqp://localhost:5673
TEST_RSA_PRIVATE_KEY=<test-only RSA key — never use prod key>
TEST_CREATOR_TOKEN=<pre-signed JWT for IncidentCreator role>
TEST_RESPONDER_TOKEN=<pre-signed JWT for IssueResponder role>
TEST_ADMIN_TOKEN=<pre-signed JWT for Administrator role>
TEST_CREATOR2_TOKEN=<second Creator for isolation tests>
TEST_RESPONDER_ID=responder-uuid-1
TEST_CREATOR1_INCIDENT_ID=<seeded incident UUID>
```

Generate test tokens with a test-only RSA key pair — never use the production IdentityService key in tests.
