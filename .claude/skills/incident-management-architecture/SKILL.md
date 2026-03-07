---
name: incident-management-architecture
description: >
  Technical Architecture reference for the Incident Management AI microservices system.
  ALWAYS use this skill alongside incident-management-srs and event-sourcing skills when
  scaffolding services, writing Dockerfiles, designing APIs, building the React UI, setting
  up an API gateway, defining inter-service communication, writing CI/CD pipelines, or making
  any infrastructure or deployment decision. Trigger on any mention of: microservice, service,
  gateway, docker, kubernetes, react app, frontend, backend, database schema, message broker,
  kafka, rabbitmq, postgres, mongodb, auth service, notification service, incident service,
  user service, API gateway, monorepo, deployment, environment variables, or tech stack.
  This skill is the authoritative technical blueprint — all generated code must conform to
  the service boundaries, tech choices, and patterns defined here.
---

# Incident Management AI — Technical Architecture Skill

This is the **authoritative technical reference** for scaffolding and building the
Incident Management AI microservices system. Read this before writing any code,
Dockerfile, API contract, or infrastructure config.

> **Always read alongside:**
> - `incident-management-srs` skill — for business rules, roles, and functional requirements
> - `event-sourcing` skill — for aggregate, event, and CQRS code patterns

---

## Quick Reference

| Concern              | Decision                                              |
|----------------------|-------------------------------------------------------|
| Architecture style   | Microservices + Event Sourcing + CQRS                 |
| Monorepo tool        | Turborepo (or Nx) — single Git repo, multiple packages|
| Frontend             | React 18 + TypeScript + Vite + Tailwind CSS           |
| Backend language     | Node.js + TypeScript (all services)                   |
| Backend framework    | Fastify (lightweight, schema-first)                   |
| Event bus            | RabbitMQ (AMQP) — async inter-service messaging       |
| Event store          | PostgreSQL (append-only `events` table per service)   |
| Read models DB       | PostgreSQL (separate schema per service)              |
| Auth mechanism       | JWT (access token) + Refresh token (httpOnly cookie)  |
| API Gateway          | Node.js + Fastify (custom, handles auth + routing)    |
| Containerization     | Docker + Docker Compose (dev), Kubernetes (prod)      |
| CI/CD                | GitHub Actions                                        |
| Secret management    | Environment variables via `.env` + Docker secrets     |

---

## Service Inventory

The system is composed of **5 backend microservices** + **1 React frontend** + **1 API Gateway**.

```
┌─────────────────────────────────────────────────────────┐
│                      React Frontend                      │
│              (Vite + TypeScript + Tailwind)              │
└───────────────────────────┬─────────────────────────────┘
                            │ HTTPS
                            ▼
┌─────────────────────────────────────────────────────────┐
│                      API Gateway                         │
│         (Auth verification + route forwarding)          │
└──┬──────────┬───────────┬────────────┬──────────────────┘
   │          │           │            │
   ▼          ▼           ▼            ▼
┌──────┐ ┌────────┐ ┌──────────┐ ┌──────────────┐
│ Auth │ │Incident│ │   User   │ │Notification  │
│Service│ │Service │ │ Service  │ │   Service    │
└──────┘ └────────┘ └──────────┘ └──────────────┘
                         │
                         ▼
                  ┌─────────────┐
                  │  Analytics  │
                  │   Service   │
                  └─────────────┘

All services communicate async via: RabbitMQ Event Bus
```

---

## Service Definitions

### 1. `auth-service` — Port 3001
**Responsibility:** User registration, login, JWT issuance, token refresh, password reset

| Domain Events Emitted         | Trigger                         |
|-------------------------------|---------------------------------|
| `UserRegistered`              | New user signs up               |
| `UserLoggedIn`                | Successful login                |
| `PasswordResetRequested`      | Password reset initiated        |
| `PasswordResetCompleted`      | Password successfully reset     |

**Key Commands:** `RegisterUser`, `LoginUser`, `RefreshToken`, `RequestPasswordReset`, `ResetPassword`

**Database:** PostgreSQL — `auth_db`
- `events` table (event store — append only)
- `user_read_models` table (projection: id, email, role, created_at, is_active)

**API Routes (internal, via gateway):**
```
POST /auth/register
POST /auth/login
POST /auth/logout
POST /auth/refresh
POST /auth/password-reset/request
POST /auth/password-reset/confirm
```

---

### 2. `incident-service` — Port 3002
**Responsibility:** Full incident lifecycle — create, status transitions, comments, assignments

| Domain Events Emitted         | Trigger                                  |
|-------------------------------|------------------------------------------|
| `IncidentCreated`             | Creator submits new issue                |
| `IncidentAssigned`            | Admin assigns to a responder             |
| `IncidentStatusChanged`       | Any status transition                    |
| `CommentAdded`                | Any user adds a comment                  |
| `IncidentEscalated`           | SLA breach triggers escalation           |
| `IncidentClosed`              | Issue moved to Closed                    |
| `IncidentReopened`            | Closed issue moved back to Open          |

**Key Commands:** `CreateIncident`, `AssignIncident`, `TransitionStatus`, `AddComment`, `CloseIncident`, `ReopenIncident`, `EscalateIncident`

**Database:** PostgreSQL — `incident_db`
- `events` table (event store — append only, indexed by aggregate_id)
- `incident_read_models` table (id, title, description, status, creator_id, assignee_id, created_at, updated_at, closed_at)
- `comment_read_models` table (id, incident_id, author_id, content, created_at)

**SLA Rules (from NFR-6):**
- Track `created_at` vs `first_response_at` vs `closed_at`
- Escalate if unassigned > configurable threshold (default: 24h)
- Auto-close configurable (default: disabled, opt-in)

**API Routes:**
```
POST   /incidents
GET    /incidents          (filtered by role — enforced in gateway)
GET    /incidents/:id
PATCH  /incidents/:id/status
POST   /incidents/:id/comments
POST   /incidents/:id/assign
POST   /incidents/:id/reopen
```

---

### 3. `user-service` — Port 3003
**Responsibility:** User profile management, responder availability, role management, workload tracking

| Domain Events Emitted         | Trigger                                  |
|-------------------------------|------------------------------------------|
| `UserProfileUpdated`          | User updates their profile               |
| `ResponderAvailabilitySet`    | Responder marks themselves available/not |
| `UserRoleChanged`             | Admin changes a user's role              |

**Database:** PostgreSQL — `user_db`
- `events` table (event store)
- `user_profiles_read` table (id, name, email, role, is_available, current_workload_count)

**API Routes:**
```
GET    /users/me
PATCH  /users/me
GET    /users/responders        (Admin: list all responders + workload)
PATCH  /users/:id/availability  (Responder: toggle availability)
PATCH  /users/:id/role          (Admin only)
```

---

### 4. `notification-service` — Port 3004
**Responsibility:** Email + in-app notifications, triggered by events from other services

**Listens to (RabbitMQ events):**
- `IncidentCreated` → notify admin
- `IncidentAssigned` → notify assigned responder
- `IncidentStatusChanged` → notify creator
- `CommentAdded` → notify other party
- `IncidentEscalated` → notify admin + responder

**No external API routes** — purely event-driven, internal only.

**Database:** PostgreSQL — `notification_db`
- `notifications` table (id, recipient_id, type, content, is_read, created_at)
- In-app notifications polled via `/notifications` route on API gateway

**Email provider:** Nodemailer (SMTP, configurable — use Mailtrap for dev)

---

### 5. `analytics-service` — Port 3005
**Responsibility:** Admin dashboard metrics, report generation, SLA reporting, export

**Listens to (RabbitMQ events):**
- All `IncidentStatusChanged` events
- `IncidentCreated`, `IncidentClosed`, `IncidentEscalated`

**Projections built:**
- Open/closed counts by date
- Average resolution time per responder
- Workload distribution (incidents per responder)
- SLA breach rate

**Database:** PostgreSQL — `analytics_db`
- `metrics_snapshots` table (denormalized for fast reads)

**API Routes:**
```
GET /analytics/dashboard        (Admin: summary stats)
GET /analytics/responders       (Admin: per-responder metrics)
GET /analytics/export?format=csv|json
```

---

### 6. `api-gateway` — Port 3000 (public-facing)
**Responsibility:** Single entry point — JWT verification, role enforcement, request routing

**Key behaviors:**
- Verify JWT on every request (except `/auth/register`, `/auth/login`, `/auth/refresh`)
- Attach decoded `userId`, `role` to forwarded request headers
- Enforce coarse-grained role rules (e.g., `/analytics/*` requires `Administrator`)
- Rate limiting (100 req/min per user)
- Request logging (structured JSON logs)
- Forward to correct upstream service via HTTP proxy

**Does NOT contain business logic** — only routing + auth enforcement.

---

### 7. `web-app` (React Frontend) — Port 5173 (dev)
**Responsibility:** Role-aware UI for all three user types

**Tech stack:**
- React 18 + TypeScript
- Vite (build tool)
- Tailwind CSS (styling)
- React Query (TanStack Query v5) — server state management
- Zustand — client state (auth user, notifications)
- React Router v6 — routing
- React Hook Form + Zod — forms and validation
- Axios — HTTP client with interceptors for JWT refresh

**Key pages/routes:**

| Route                        | Role Access            | Description                        |
|------------------------------|------------------------|------------------------------------|
| `/login`                     | Public                 | Login form                         |
| `/register`                  | Public                 | Creator registration               |
| `/dashboard`                 | Creator                | My incidents list                  |
| `/incidents/new`             | Creator                | Create incident form               |
| `/incidents/:id`             | Creator + Responder    | Incident detail + comment thread   |
| `/responder/queue`           | Responder              | Assigned incidents queue           |
| `/admin/dashboard`           | Administrator          | Analytics + stats                  |
| `/admin/incidents`           | Administrator          | All incidents + assignment UI      |
| `/admin/users`               | Administrator          | User + responder management        |

---

## Monorepo Structure

```
incident-management-ai/
├── apps/
│   ├── api-gateway/          # Fastify API gateway
│   ├── auth-service/         # Auth microservice
│   ├── incident-service/     # Incident microservice
│   ├── user-service/         # User microservice
│   ├── notification-service/ # Notification microservice
│   ├── analytics-service/    # Analytics microservice
│   └── web-app/              # React frontend
├── packages/
│   ├── shared-types/         # TypeScript types shared across services
│   ├── event-contracts/      # Event envelope types + RabbitMQ exchange names
│   ├── auth-utils/           # JWT verify helper (used by gateway + services)
│   └── logger/               # Shared structured logger (pino)
├── infra/
│   ├── docker/               # Per-service Dockerfiles
│   ├── docker-compose.yml    # Full local dev stack
│   ├── docker-compose.test.yml
│   └── k8s/                  # Kubernetes manifests (prod)
├── .github/
│   └── workflows/            # CI/CD pipelines
├── turbo.json                # Turborepo config
├── package.json              # Workspace root
└── README.md
```

---

## Per-Service Folder Structure

Every backend service follows this layout (aligned with `event-sourcing` skill):

```
apps/<service-name>/
├── src/
│   ├── domain/
│   │   ├── events/           # e.g. IncidentCreated.ts
│   │   ├── commands/         # e.g. CreateIncident.ts
│   │   ├── aggregates/       # e.g. IncidentAggregate.ts
│   │   └── value-objects/    # e.g. IncidentStatus.ts
│   ├── application/
│   │   ├── command-handlers/ # e.g. CreateIncidentHandler.ts
│   │   └── query-handlers/   # e.g. GetIncidentByIdHandler.ts
│   ├── infrastructure/
│   │   ├── event-store/      # PostgresEventStore.ts
│   │   ├── projections/      # e.g. IncidentReadModelProjector.ts
│   │   ├── read-models/      # e.g. IncidentReadModelRepo.ts
│   │   └── messaging/        # RabbitMQ publisher + consumer
│   ├── api/
│   │   ├── routes/           # Fastify route definitions
│   │   └── schemas/          # JSON Schema for request validation
│   ├── config/               # env config, DB connection, RabbitMQ setup
│   └── main.ts               # Entry point
├── tests/
│   ├── unit/
│   └── integration/
├── Dockerfile
├── .env.example
├── package.json
└── tsconfig.json
```

---

## Inter-Service Communication

### Synchronous (HTTP via Gateway)
- All client → backend calls go through the API Gateway
- Gateway proxies to upstream services via internal HTTP
- Services do NOT call each other directly via HTTP (avoid coupling)

### Asynchronous (RabbitMQ Events)
- Use **topic exchange** named `incident.events`
- Routing key pattern: `<service>.<aggregate>.<event>` 
  - e.g. `incident.incident.IncidentCreated`
  - e.g. `auth.user.UserRegistered`
- Each consuming service declares its own **durable queue** bound to relevant routing keys
- All events use the standard envelope from the `event-sourcing` skill

```
┌─────────────────┐    publish     ┌──────────────────────┐
│ incident-service│ ─────────────▶ │  RabbitMQ Exchange   │
└─────────────────┘                │  (incident.events)   │
                                   └──────────┬───────────┘
                                              │
                    ┌─────────────────────────┼──────────────────────┐
                    ▼                         ▼                      ▼
           ┌──────────────┐        ┌─────────────────┐    ┌──────────────────┐
           │notification  │        │  analytics      │    │  user-service    │
           │  queue       │        │  queue          │    │  queue           │
           └──────────────┘        └─────────────────┘    └──────────────────┘
```

---

## Authentication & Authorization Flow

```
1. Client → POST /auth/login → Gateway → auth-service
2. auth-service returns: { accessToken, refreshToken (httpOnly cookie) }
3. Client stores accessToken in memory (NOT localStorage)
4. Every request: Authorization: Bearer <accessToken>
5. Gateway verifies JWT signature + expiry
6. Gateway injects: x-user-id, x-user-role headers to upstream service
7. Services trust these headers (only accept requests from gateway)
8. On 401: Client uses refresh token to get new access token silently
```

**JWT Payload:**
```json
{
  "sub": "user-uuid",
  "role": "IncidentCreator | IssueResponder | Administrator",
  "iat": 1700000000,
  "exp": 1700003600
}
```

**Access token TTL:** 15 minutes  
**Refresh token TTL:** 7 days

---

## Database Strategy

- **One PostgreSQL database per service** (database-per-service pattern)
- Services NEVER share a database or query another service's DB
- Each service DB has:
  - `events` table (event store — append only, never updated/deleted)
  - Read model tables (projections)

**Standard `events` table schema (all services):**
```sql
CREATE TABLE events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aggregate_id  UUID NOT NULL,
  aggregate_type VARCHAR(100) NOT NULL,
  event_type    VARCHAR(100) NOT NULL,
  event_version INT NOT NULL DEFAULT 1,
  payload       JSONB NOT NULL,
  metadata      JSONB,
  occurred_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  sequence_num  BIGSERIAL
);

CREATE INDEX idx_events_aggregate_id ON events(aggregate_id);
CREATE INDEX idx_events_event_type ON events(event_type);
CREATE INDEX idx_events_occurred_at ON events(occurred_at);
```

---

## Environment Variables (per service)

Every service must have a `.env.example` with at minimum:

```env
# Server
PORT=300X
NODE_ENV=development

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/service_db

# RabbitMQ
RABBITMQ_URL=amqp://user:pass@localhost:5672

# Auth (all services except auth-service itself)
JWT_PUBLIC_KEY=<rsa-public-key-or-shared-secret>

# Auth service only
JWT_PRIVATE_KEY=<rsa-private-key>
JWT_ACCESS_TTL=900
JWT_REFRESH_TTL=604800

# Notification service only
SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=2525
SMTP_USER=
SMTP_PASS=
```

---

## Docker Compose (Local Dev)

All services run together via `docker-compose.yml`:

```yaml
services:
  rabbitmq:
    image: rabbitmq:3-management
    ports: ["5672:5672", "15672:15672"]

  postgres-auth:
    image: postgres:16
    environment: { POSTGRES_DB: auth_db, ... }

  postgres-incident:
    image: postgres:16
    environment: { POSTGRES_DB: incident_db, ... }

  # ... one postgres instance per service (or shared with different DBs)

  auth-service:
    build: ./apps/auth-service
    depends_on: [rabbitmq, postgres-auth]

  incident-service:
    build: ./apps/incident-service
    depends_on: [rabbitmq, postgres-incident]

  # ... all other services

  api-gateway:
    build: ./apps/api-gateway
    ports: ["3000:3000"]
    depends_on: [auth-service, incident-service, ...]

  web-app:
    build: ./apps/web-app
    ports: ["5173:5173"]
    depends_on: [api-gateway]
```

---

## CI/CD (GitHub Actions)

Recommended pipeline per PR:

```
1. Lint (ESLint + Prettier check)
2. Type check (tsc --noEmit)
3. Unit tests (Vitest)
4. Integration tests (Docker Compose test stack)
5. Build Docker images
6. Push to registry (on merge to main)
7. Deploy to staging (on merge to main)
```

---

## Security Checklist

- [ ] All services only accept internal requests (no direct public exposure — only gateway is public)
- [ ] JWT verified on every protected route in gateway
- [ ] Passwords hashed with bcrypt (cost factor ≥ 12)
- [ ] Refresh tokens stored as hashed values in DB
- [ ] All DB connections use SSL in production
- [ ] Rate limiting on API gateway (per user + per IP)
- [ ] Input validation using JSON Schema on every route (Fastify built-in)
- [ ] CORS configured to allow only frontend origin
- [ ] No secrets in source code — all via env vars

---

## How to Use This Skill

- **Starting a new service?** Use the per-service folder structure above + event-sourcing skill for domain code patterns.
- **Adding an API route?** Check service definitions above for which service owns it; enforce role check at gateway level.
- **Writing a domain event?** Follow event-sourcing skill envelope standard + register routing key in `event-contracts` package.
- **Building a UI page?** Check the routes table above for role access; use React Query for data fetching.
- **Setting up Docker?** Use the docker-compose structure above; each service gets its own DB.
- **Designing inter-service flow?** Use async RabbitMQ events — services NEVER call each other via HTTP directly.
- **CI/CD?** GitHub Actions with the 7-step pipeline above.

> Also read `references/service-contracts.md` for full API request/response shapes per service.
> Also read `references/rabbitmq-events.md` for the complete event catalog with payload schemas.
