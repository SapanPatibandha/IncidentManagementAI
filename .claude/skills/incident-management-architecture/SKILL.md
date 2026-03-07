---
name: incident-management-architecture
description: >
  Technical Architecture reference for the Incident Management AI microservices system.
  ALWAYS use this skill alongside incident-management-srs and event-sourcing skills when
  scaffolding services, writing Dockerfiles, designing APIs, building the React UI, setting
  up an API gateway, defining inter-service communication, writing CI/CD pipelines, or making
  any infrastructure or deployment decision. Trigger on any mention of: microservice, service,
  gateway, docker, kubernetes, react app, frontend, backend, database schema, message broker,
  kafka, rabbitmq, postgres, mongodb, identity service, auth, oauth, jwt, notification service,
  incident service, user service, API gateway, monorepo, deployment, environment variables,
  or tech stack. This skill is the authoritative technical blueprint — all generated code must
  conform to the service boundaries, tech choices, and patterns defined here.
  CRITICAL: Authentication and identity is handled exclusively by the external IdentityService
  repo (github.com/SapanPatibandha/IdentityService) — do NOT build a custom auth-service.
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

| Concern              | Decision                                                              |
|----------------------|-----------------------------------------------------------------------|
| Architecture style   | Microservices + Event Sourcing + CQRS                                 |
| Monorepo tool        | Turborepo (or Nx) — single Git repo, multiple packages                |
| Frontend             | React 18 + TypeScript + Vite + Tailwind CSS                           |
| Backend language     | Node.js + TypeScript (all services except IdentityService)            |
| Backend framework    | Fastify (lightweight, schema-first)                                   |
| Event bus            | RabbitMQ (AMQP) — async inter-service messaging                       |
| Event store          | PostgreSQL (append-only `events` table per service)                   |
| Read models DB       | PostgreSQL (separate schema per service)                              |
| **Identity & Auth**  | **External IdentityService (.NET 10 + PostgreSQL) — OAuth 2.0 + JWT** |
| Auth token type      | JWT signed with RSA asymmetric keys (issued by IdentityService)       |
| API Gateway          | Node.js + Fastify — verifies JWT using IdentityService public key     |
| Containerization     | Docker + Docker Compose (dev), Kubernetes (prod)                      |
| CI/CD                | GitHub Actions                                                        |
| Secret management    | Environment variables via `.env` + Docker secrets                     |

---

## Service Inventory

The system is composed of **1 external IdentityService** + **4 backend microservices** + **1 React frontend** + **1 API Gateway**.

```
┌─────────────────────────────────────────────────────────┐
│                      React Frontend                      │
│              (Vite + TypeScript + Tailwind)              │
└───────────────────────────┬─────────────────────────────┘
                            │ HTTPS
                            ▼
┌─────────────────────────────────────────────────────────┐
│                      API Gateway                         │
│   JWT verify (RSA public key) + route forwarding        │
└──┬──────────┬───────────┬────────────┬──────────────────┘
   │          │           │            │
   ▼          ▼           ▼            ▼
┌────────────────┐ ┌────────┐ ┌──────────┐ ┌──────────────┐
│IdentityService │ │Incident│ │   User   │ │Notification  │
│ (.NET 10)      │ │Service │ │ Service  │ │   Service    │
│ OAuth2 + JWT   │ └────────┘ └──────────┘ └──────────────┘
│ Port: 8080     │               │
│ (external repo)│               ▼
└────────────────┘        ┌─────────────┐
                          │  Analytics  │
                          │   Service   │
                          └─────────────┘

All internal services communicate async via: RabbitMQ Event Bus
IdentityService is a standalone service — integrated via OAuth2/JWT only
```

---

## Service Definitions

### 1. `IdentityService` — Port 8080 (external repo)
**Repo:** `https://github.com/SapanPatibandha/IdentityService`  
**Tech stack:** .NET 10 + PostgreSQL + Clean Architecture  
**Responsibility:** All authentication and authorization for the entire platform. This is a **pre-built, standalone service** — do NOT rewrite or duplicate any of its functionality in other services.

**Key capabilities used by this system:**
- OAuth 2.0 Authorization Code flow (for web app login)
- Client Credentials grant (for service-to-service calls)
- JWT issuance signed with **RSA asymmetric keys**
- Token refresh + revocation
- Scope-based access control: `api:featureName:action` pattern
- Username/password + bcrypt hashing
- Two-Factor Authentication (TOTP + email codes)
- Email verification on registration
- Account lockout after 5 failed attempts
- Multi-tenant OAuth2 client management
- Audit logs via `GET /api/v1/admin/audit-logs`

**Scopes to register for this system:**
| Scope                        | Granted to                  | Allows                          |
|------------------------------|-----------------------------|---------------------------------|
| `api:incidents:read`         | IncidentCreator, Responder  | Read own/assigned incidents     |
| `api:incidents:write`        | IncidentCreator             | Create incidents, add comments  |
| `api:incidents:manage`       | IssueResponder              | Transition status, add comments |
| `api:incidents:admin`        | Administrator               | Full incident access + assign   |
| `api:users:read`             | Administrator               | View all users + responders     |
| `api:users:manage`           | Administrator               | Change roles, manage users      |
| `api:analytics:read`         | Administrator               | View dashboard + export         |
| `api:notifications:read`     | All authenticated users     | Read own notifications          |

**OAuth2 Client to register:**
- Client name: `incident-management-web`
- Grant type: `authorization_code` + `refresh_token`
- Redirect URI: `http://localhost:5173/auth/callback` (dev)

**API endpoints used by gateway:**
```
POST /api/v1/auth/token          — exchange code for JWT
POST /api/v1/auth/refresh        — refresh access token
POST /api/v1/auth/revoke         — logout / revoke token
GET  /api/v1/admin/users         — Admin: list users
GET  /openapi/v1.json            — Swagger spec
```

**JWT payload structure (issued by IdentityService):**
```json
{
  "sub": "user-uuid",
  "email": "user@example.com",
  "scope": "api:incidents:write api:notifications:read",
  "client_id": "incident-management-web",
  "iat": 1700000000,
  "exp": 1700003600
}
```

**Integration rules for all other services:**
- NEVER build login, registration, or token issuance logic in any other service
- The API gateway validates JWT using IdentityService's **RSA public key** (fetched from `/.well-known/jwks.json` or configured as env var)
- Gateway extracts `sub` (userId), `scope`, and `email` from the token and injects them as request headers: `x-user-id`, `x-user-scopes`, `x-user-email`
- Downstream services trust these headers — they never re-verify the JWT
- Role mapping (IncidentCreator / IssueResponder / Administrator) is derived from scopes

**Role ↔ Scope mapping (enforced at gateway):**
| Role               | Required scope prefix         |
|--------------------|-------------------------------|
| IncidentCreator    | `api:incidents:write`         |
| IssueResponder     | `api:incidents:manage`        |
| Administrator      | `api:incidents:admin`         |

**Docker Compose integration:**
```yaml
identity-service:
  image: sapanpatibandha/identity-service:latest  # or build from repo
  ports: ["8080:8080"]
  environment:
    - ConnectionStrings__DefaultConnection=Host=postgres-identity;Database=identity_db;...
    - Jwt__RsaPrivateKey=<base64-encoded-private-key>
  depends_on: [postgres-identity]

postgres-identity:
  image: postgres:16
  environment: { POSTGRES_DB: identity_db, ... }
```

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
│   ├── api-gateway/          # Fastify API gateway (JWT verify via IdentityService JWKS)
│   ├── incident-service/     # Incident microservice
│   ├── user-service/         # User microservice
│   ├── notification-service/ # Notification microservice
│   ├── analytics-service/    # Analytics microservice
│   └── web-app/              # React frontend
├── packages/
│   ├── shared-types/         # TypeScript types shared across services
│   ├── event-contracts/      # Event envelope types + RabbitMQ exchange names
│   ├── identity-client/      # Typed HTTP client for IdentityService API (admin calls)
│   └── logger/               # Shared structured logger (pino)
├── infra/
│   ├── docker/               # Per-service Dockerfiles
│   ├── docker-compose.yml    # Full local dev stack (includes IdentityService)
│   ├── docker-compose.test.yml
│   └── k8s/                  # Kubernetes manifests (prod)
├── .github/
│   └── workflows/            # CI/CD pipelines
├── turbo.json                # Turborepo config
├── package.json              # Workspace root
└── README.md

# IdentityService lives in a SEPARATE repo alongside this one:
# ../IdentityService/         # github.com/SapanPatibandha/IdentityService
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
1. User clicks "Login" in React app
2. React app redirects to IdentityService: GET /oauth/authorize?client_id=...&scope=...
3. IdentityService handles login UI, 2FA, email verification
4. IdentityService redirects back to React: /auth/callback?code=...
5. React app sends code → API Gateway → IdentityService POST /api/v1/auth/token
6. IdentityService returns: { access_token (JWT), refresh_token, expires_in }
7. React stores access_token in memory (NOT localStorage), refresh_token in httpOnly cookie
8. Every API request: Authorization: Bearer <access_token>
9. Gateway validates JWT signature using IdentityService RSA public key
10. Gateway extracts sub, scope, email → injects x-user-id, x-user-scopes, x-user-email headers
11. Downstream services use injected headers — never re-verify JWT
12. On 401: React silently calls POST /api/v1/auth/refresh using httpOnly cookie
```

**Role derived from scopes (gateway logic):**
```typescript
function deriveRole(scopes: string[]): string {
  if (scopes.includes('api:incidents:admin')) return 'Administrator';
  if (scopes.includes('api:incidents:manage')) return 'IssueResponder';
  if (scopes.includes('api:incidents:write')) return 'IncidentCreator';
  throw new UnauthorizedException();
}
```

**RSA public key setup (API Gateway):**
- Fetch from `http://identity-service:8080/.well-known/jwks.json` on startup
- Cache the key, refresh every 24h
- Verify every JWT with this key before forwarding any request

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

# IdentityService integration (all services + gateway)
IDENTITY_SERVICE_URL=http://identity-service:8080
IDENTITY_SERVICE_JWKS_URL=http://identity-service:8080/.well-known/jwks.json
# RSA public key can also be set directly as alternative to JWKS URL:
# IDENTITY_SERVICE_RSA_PUBLIC_KEY=<base64-encoded-rsa-public-key>

# Notification service only
SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=2525
SMTP_USER=
SMTP_PASS=
```

**IdentityService itself** uses its own env vars (see its repo). Key ones to configure in docker-compose:
```env
# Set in identity-service container
Jwt__RsaPrivateKey=<base64-encoded-private-key>
ConnectionStrings__DefaultConnection=Host=postgres-identity;Database=identity_db;Username=...;Password=...
```

---

## Docker Compose (Local Dev)

All services run together via `docker-compose.yml`:

```yaml
services:
  rabbitmq:
    image: rabbitmq:3-management
    ports: ["5672:5672", "15672:15672"]

  # IdentityService — external repo, handles all auth
  postgres-identity:
    image: postgres:16
    environment: { POSTGRES_DB: identity_db, POSTGRES_USER: ..., POSTGRES_PASSWORD: ... }

  identity-service:
    build:
      context: ../IdentityService   # path to cloned IdentityService repo
      dockerfile: Dockerfile
    ports: ["8080:8080"]
    environment:
      - ConnectionStrings__DefaultConnection=Host=postgres-identity;Database=identity_db;...
      - Jwt__RsaPrivateKey=<base64-key>
    depends_on: [postgres-identity]

  postgres-incident:
    image: postgres:16
    environment: { POSTGRES_DB: incident_db, ... }

  postgres-user:
    image: postgres:16
    environment: { POSTGRES_DB: user_db, ... }

  postgres-notification:
    image: postgres:16
    environment: { POSTGRES_DB: notification_db, ... }

  postgres-analytics:
    image: postgres:16
    environment: { POSTGRES_DB: analytics_db, ... }

  incident-service:
    build: ./apps/incident-service
    depends_on: [rabbitmq, postgres-incident, identity-service]

  user-service:
    build: ./apps/user-service
    depends_on: [rabbitmq, postgres-user, identity-service]

  notification-service:
    build: ./apps/notification-service
    depends_on: [rabbitmq, postgres-notification]

  analytics-service:
    build: ./apps/analytics-service
    depends_on: [rabbitmq, postgres-analytics]

  api-gateway:
    build: ./apps/api-gateway
    ports: ["3000:3000"]
    environment:
      - IDENTITY_SERVICE_JWKS_URL=http://identity-service:8080/.well-known/jwks.json
    depends_on: [identity-service, incident-service, user-service, notification-service, analytics-service]

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
