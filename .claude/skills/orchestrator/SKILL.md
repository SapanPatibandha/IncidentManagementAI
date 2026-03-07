---
name: orchestrator
description: >
  Master build orchestrator for the Incident Management AI system. ALWAYS read this skill
  first before starting any new work session or scaffolding any service. Trigger on any
  mention of: where do I start, what do I build next, build order, scaffold, create service,
  start coding, next step, current status, what's done, sprint, phase, or any question about
  sequencing work. This skill defines the authoritative build sequence, dependencies between
  services, and the definition of done for each layer. Without this skill, Claude may build
  things in the wrong order causing wiring and dependency failures.
---

# Incident Management AI — Orchestrator Skill

This skill controls **what to build, in what order, and what done means** for each piece.
Read this at the start of every session to orient yourself before touching any code.

> **This skill does not replace the others — it tells you when to use them.**
> Always load: `incident-management-srs` + `event-sourcing` + `incident-management-architecture`
> + `incident-management-ui` + `testing-standards` alongside this one.

---

## Master Build Sequence

Work must proceed in this order. Never start a phase before the previous one is complete.
Each phase has hard dependencies — violating the order causes cascading failures.

```
Phase 0 — Foundation         (no dependencies)
Phase 1 — Identity wiring    (depends on Phase 0)
Phase 2 — API Gateway        (depends on Phase 1)
Phase 3 — Incident Service   (depends on Phase 0 + 2)
Phase 4 — User Service       (depends on Phase 0 + 2)
Phase 5 — Notification Svc   (depends on Phase 3 + 4)
Phase 6 — Analytics Service  (depends on Phase 3)
Phase 7 — React Frontend     (depends on Phase 2 + all services)
Phase 8 — Integration        (depends on all phases)
Phase 9 — CI/CD + Deploy     (depends on Phase 8)
```

---

## Phase 0 — Shared Foundation

**What:** Monorepo scaffold + shared packages. Every service imports from these.

### Tasks
- [ ] Init Turborepo monorepo (`apps/`, `packages/`, `infra/`)
- [ ] `packages/shared-types` — all TypeScript interfaces (Incident, User, Comment, etc.)
- [ ] `packages/event-contracts` — event envelope type, exchange names, routing keys
- [ ] `packages/logger` — pino wrapper (structured JSON logging, same config everywhere)
- [ ] `packages/identity-client` — typed Axios client for IdentityService admin API
- [ ] Root `tsconfig.json`, `eslint.config.js`, `.prettierrc`
- [ ] `infra/docker-compose.yml` skeleton (postgres instances + rabbitmq + identity-service)

### Definition of Done
- All packages build with `tsc --noEmit` zero errors
- `docker-compose up` starts postgres + rabbitmq + identity-service successfully
- IdentityService health check responds at `http://localhost:8080/health`

---

## Phase 1 — IdentityService Integration

**What:** Configure IdentityService for this system's OAuth2 clients and scopes.

### Tasks
- [ ] Register OAuth2 client `incident-management-web` in IdentityService
- [ ] Define all scopes: `api:incidents:write`, `api:incidents:manage`, `api:incidents:admin`, etc.
- [ ] Fetch and store RSA public key / JWKS URL for gateway use
- [ ] Document client_id + client_secret in `.env.example` files
- [ ] Verify token issuance works end-to-end with a test curl

### Definition of Done
- `POST /api/v1/auth/token` returns a valid JWT with correct scopes
- JWT decodes with the RSA public key successfully
- `GET /.well-known/jwks.json` returns valid JWKS

---

## Phase 2 — API Gateway

**What:** The single public entry point. All other services are private.

### Tasks
- [ ] Fastify app scaffold with TypeScript
- [ ] JWKS fetcher — load RSA public key from IdentityService on startup, refresh every 24h
- [ ] JWT verification middleware — validate every request except `/health`
- [ ] Role derivation — map scopes → role, inject `x-user-id`, `x-user-role`, `x-user-email`
- [ ] Route proxy — forward to each upstream service by path prefix
- [ ] Rate limiting — 100 req/min per user
- [ ] Request logging (pino)
- [ ] Health check endpoint `GET /health`
- [ ] Error handling — return standardised `{ error, message, statusCode }` shape

### Service route prefixes
```
/auth/*           → identity-service:8080/api/v1/auth/*   (public — no JWT check)
/incidents/*      → incident-service:3002
/users/*          → user-service:3003
/notifications/*  → notification-service:3004
/analytics/*      → analytics-service:3005 (requires Administrator scope)
```

### Definition of Done
- Valid JWT → request forwarded with injected headers
- Invalid/expired JWT → 401 returned immediately, not forwarded
- Missing scope for route → 403 returned
- All unit tests pass for JWT verify + role derivation logic

---

## Phase 3 — Incident Service (most complex — take your time)

**What:** The core domain. Full incident lifecycle using Event Sourcing + CQRS.

### Build order within this service (strict — follow event-sourcing skill)
```
1. Domain layer first:
   - Value objects: IncidentStatus, Priority
   - Events: IncidentCreated, IncidentAssigned, IncidentStatusChanged,
             CommentAdded, IncidentClosed, IncidentReopened, IncidentEscalated
   - Commands: CreateIncident, AssignIncident, TransitionStatus,
               AddComment, CloseIncident, ReopenIncident
   - Aggregate: IncidentAggregate (pure — no DB, no HTTP)

2. Infrastructure layer:
   - PostgresEventStore (append-only events table)
   - IncidentReadModelProjector (events → read model table)
   - RabbitMQ publisher (publish events after save)
   - RabbitMQ consumer (listen for ResponderAvailabilitySet)

3. Application layer:
   - Command handlers (one per command)
   - Query handlers (GetIncidentById, ListIncidents)

4. API layer:
   - Fastify routes (from architecture skill service-contracts.md)
   - Input validation schemas
   - Permission checks using injected x-user-role header

5. Tests (from testing-standards skill)
```

### Critical business rules to enforce (from SRS skill)
- Creator sees ONLY their own incidents
- Responder sees ONLY assigned incidents
- Status transitions follow exact SRS rules — validate in aggregate, not in API layer
- Every status change stores actor + timestamp + previous status in event payload

### Definition of Done
- All domain events defined with version field
- Aggregate handles all commands, emits correct events
- Read model projection rebuilds correctly from events
- All API routes respond per service-contracts.md shapes
- RabbitMQ events published on every state change
- Unit tests: aggregate handles all valid + invalid transitions
- Integration tests: full lifecycle via API (create → assign → in-process → close)

---

## Phase 4 — User Service

**What:** User profiles, responder availability, workload tracking, user sync from IdentityService.

### Tasks
- [ ] Sync users from IdentityService on startup (poll `GET /api/v1/admin/users`)
- [ ] User profile read model (id, name, email, role, isAvailable, workloadCount)
- [ ] Consume `IncidentAssigned` + `IncidentClosed` events → update workload count
- [ ] Responder availability toggle (PATCH /users/:id/availability)
- [ ] Publish `ResponderAvailabilitySet` to RabbitMQ → incident-service listens

### Definition of Done
- Users from IdentityService visible in user-service read model
- Workload count increments on IncidentAssigned, decrements on IncidentClosed
- Availability toggle works and publishes event

---

## Phase 5 — Notification Service

**What:** Email + in-app notifications, purely event-driven.

### Tasks
- [ ] RabbitMQ consumers for all incident events
- [ ] In-app notification write model (store in postgres)
- [ ] Email sender via Nodemailer (Mailtrap for dev)
- [ ] Notification read API (`GET /notifications`, `PATCH /notifications/:id/read`)

### Notification triggers (from rabbitmq-events.md)
| Event                  | Notify whom              | Channel       |
|------------------------|--------------------------|---------------|
| IncidentCreated        | Admin                    | In-app        |
| IncidentAssigned       | Assigned responder       | Email + in-app|
| IncidentStatusChanged  | Creator                  | Email + in-app|
| CommentAdded           | Other party              | In-app        |
| IncidentEscalated      | Admin + responder        | Email + in-app|

### Definition of Done
- All events trigger correct notification recipients
- Email templates render correctly (Mailtrap inbox test)
- In-app notifications API returns unread count + list

---

## Phase 6 — Analytics Service

**What:** Admin dashboard metrics, projections from incident events.

### Tasks
- [ ] Consume all `incident.incident.*` RabbitMQ events
- [ ] Build projections: open/closed counts, avg resolution time, per-responder workload
- [ ] Dashboard API endpoint
- [ ] Per-responder metrics endpoint
- [ ] CSV/JSON export endpoint

### Definition of Done
- Dashboard stats match manual count of incidents in incident-service
- Export produces valid CSV with all required columns

---

## Phase 7 — React Frontend

**What:** Role-aware UI. Read `incident-management-ui` skill fully before starting.

### Build order within frontend
```
1. Project scaffold (Vite + TypeScript + Tailwind + shadcn/ui init)
2. Shared infrastructure:
   - Axios instance + interceptors (JWT attach + silent refresh)
   - Zustand auth store
   - React Query client config
   - AppLayout (sidebar + topbar shell)
   - Shared components (StatusBadge, PageSkeleton, ErrorState, EmptyState)

3. Auth flow:
   - /login redirect page → IdentityService OAuth
   - /auth/callback handler → exchange code → store token → redirect by role

4. IncidentCreator pages:
   - /dashboard (incident list + filters)
   - /incidents/new (create form)
   - /incidents/:id (detail + comments + status button)

5. IssueResponder pages:
   - /queue (assigned incidents)

6. Administrator pages:
   - /admin (dashboard stats)
   - /admin/incidents (all incidents + assign)
   - /admin/users (user management)

7. Notifications (bell icon + dropdown in topbar)
```

### Definition of Done
- All role-based routes protected and redirect correctly
- All pages handle loading/error/empty states
- Forms validate client-side before submitting
- Silent JWT refresh works (test by expiring token manually)
- Responsive at 375px (mobile) and 1280px (desktop)

---

## Phase 8 — Integration Testing

**What:** Verify all services work together end-to-end.

### Critical paths to test
- [ ] Login → Create incident → See in dashboard
- [ ] Admin assigns incident → Responder sees in queue → Email notification sent
- [ ] Responder moves In-Process → Creator sees status change
- [ ] Responder closes → Creator can reopen
- [ ] Creator tries to see another creator's incident → 403
- [ ] Token expires → silent refresh → request retried transparently
- [ ] Analytics dashboard shows correct counts after incident lifecycle

---

## Phase 9 — CI/CD

**What:** GitHub Actions pipeline.

### Pipeline stages
```
1. Lint (ESLint + Prettier)
2. Type check (tsc --noEmit all packages)
3. Unit tests (Vitest)
4. Build Docker images
5. Integration tests (Docker Compose test stack)
6. Push images (on merge to main)
7. Deploy to staging (on merge to main)
```

---

## How to Use This Skill in a Session

When starting a new coding session, tell Claude:

> "Read AGENTS.md, then load all skills listed there.
> Check the orchestrator skill for current phase and next tasks.
> Then proceed with: [specific task]."

When asking Claude to start a new phase:
> "Phase 3 is complete. Begin Phase 4 — User Service.
> Follow the orchestrator skill build order for this service."

When resuming interrupted work:
> "We were building the incident-service domain layer.
> The IncidentAggregate is done. Next task is the PostgresEventStore."
