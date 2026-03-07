# Incident Management AI — Agent Context

This file is read automatically by Claude Code at the start of every session.
It provides the orientation every agent needs before touching any code.

---

## 🔴 READ ALL SKILLS BEFORE WRITING ANY CODE

Load these skill files in this exact order:

```
1. .claude/skills/orchestrator/SKILL.md                          ← build sequence + current status
2. .claude/skills/incident-management-srs/SKILL.md               ← business rules + roles
3. .claude/skills/event-sourcing/SKILL.md                        ← CQRS + event sourcing patterns
4. .claude/skills/incident-management-architecture/SKILL.md      ← services + tech stack + API contracts
5. .claude/skills/incident-management-ui/SKILL.md                ← React frontend patterns
6. .claude/skills/testing-standards/SKILL.md                     ← how to write tests
```

Never write code based on assumptions — if something conflicts with a skill file, ask before proceeding.

---

## Project Overview

**What we're building:**
A microservices-based Incident Management platform with:
- 4 Node.js/TypeScript backend services (Fastify + Event Sourcing)
- 1 React 18 frontend (Vite + Tailwind + shadcn/ui)
- 1 API Gateway (Node.js/Fastify)
- 1 External IdentityService (.NET 10) for OAuth2 + JWT auth
- RabbitMQ for async inter-service messaging
- PostgreSQL (one DB per service)

**Repos:**
- This repo: `https://github.com/SapanPatibandha/IncidentManagementAI`
- Identity service: `https://github.com/SapanPatibandha/IdentityService` (external, pre-built)

---

## Current Build Status

> Update this section as each phase is completed.

- [X] **Phase 0** — Shared Foundation (monorepo, shared packages)
- [X] **Phase 1** — IdentityService integration (OAuth2 client + scopes configured)
- [X] **Phase 2** — API Gateway (JWT verify + routing)
- [X] **Phase 3** — Incident Service (core domain — Event Sourcing)
- [ ] **Phase 4** — User Service
- [ ] **Phase 5** — Notification Service
- [ ] **Phase 6** — Analytics Service
- [ ] **Phase 7** — React Frontend
- [ ] **Phase 8** — Integration Testing
- [ ] **Phase 9** — CI/CD

**Currently working on:** Phase 0 — starting fresh

---

## Key Constraints (never violate these)

1. **No custom auth code** — all authentication is handled by IdentityService. Do NOT build login, registration, or JWT issuance in any other service.
2. **Event Sourcing everywhere** — every state change is an immutable event. No direct UPDATE queries on domain tables.
3. **Database per service** — services NEVER share a database or query each other's DB directly.
4. **No direct HTTP between services** — services communicate via RabbitMQ events only (except API Gateway → services).
5. **Role enforcement at gateway** — downstream services trust injected `x-user-id` and `x-user-role` headers.
6. **Creator data isolation** — a Creator must NEVER see another Creator's incidents. Enforce at query level.

---

## Monorepo Layout

```
IncidentManagementAI/
├── AGENTS.md                          ← you are here
├── apps/
│   ├── api-gateway/
│   ├── incident-service/
│   ├── user-service/
│   ├── notification-service/
│   ├── analytics-service/
│   └── web-app/                       ← React frontend
├── packages/
│   ├── shared-types/
│   ├── event-contracts/
│   ├── identity-client/
│   └── logger/
├── infra/
│   ├── docker-compose.yml
│   └── k8s/
└── .claude/
    └── skills/
        ├── orchestrator/
        ├── incident-management-srs/
        ├── event-sourcing/
        ├── incident-management-architecture/
        ├── incident-management-ui/
        └── testing-standards/
```

---

## How to Start a Session

**Starting fresh (first time):**
```
Read AGENTS.md and all skills listed there.
We are starting Phase 0. Scaffold the Turborepo monorepo structure
and create the shared-types and event-contracts packages.
Follow the orchestrator skill for the exact tasks and definition of done.
```

**Resuming work:**
```
Read AGENTS.md and all skills listed there.
Current status: [paste current build status from above].
Last completed: [describe what was last done].
Continue with: [next task from orchestrator skill].
```

**Starting a specific service:**
```
Read AGENTS.md and all skills listed there.
Begin Phase 3 — Incident Service.
Follow the orchestrator skill build order strictly:
domain layer first (value objects → events → commands → aggregate),
then infrastructure, then application, then API, then tests.
```
