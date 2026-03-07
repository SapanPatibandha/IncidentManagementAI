---
name: event-sourcing
description: >
  Apply Event Sourcing + CQRS architecture patterns when generating any code project.
  Use this skill whenever the user is building a backend service, API, domain model,
  or any system that involves state changes, persistence, or business logic — even if
  they don't explicitly mention "event sourcing". Trigger on keywords like: order system,
  booking, inventory, wallet, account, domain model, microservice, audit trail, history,
  replay, DDD, aggregate, projection, CQRS, command, event store, read model, write model.
  This skill ensures every code project Claude generates is structured around immutable
  events as the source of truth, rather than mutable state.
---

# Event Sourcing Skill

This skill guides Claude to architect and generate code using **Event Sourcing + CQRS** patterns.
Instead of storing current state (CRUD), the system stores a sequence of immutable events.
State is derived by replaying those events.

> **When generating code**, always read `references/patterns.md` for language-specific templates
> and `references/structure.md` for folder/file layout guidance.

---

## Core Concepts (Always Apply)

### 1. Events Are the Source of Truth
- Every state change is captured as an **immutable, past-tense event** (e.g., `OrderPlaced`, `PaymentProcessed`, `ItemShipped`)
- Events are **never deleted or mutated** — only appended
- Current state is derived by **replaying events** from the beginning (or from a snapshot)

### 2. Aggregates
- An **Aggregate** is the consistency boundary — it owns a stream of events
- Each aggregate has:
  - A unique **ID** (stream ID)
  - An **apply(event)** method that mutates internal state
  - A **handle(command)** method that validates and emits events
- Aggregates must **never** call external services — they are pure in-memory objects

### 3. Commands vs Events
| Concept | Direction | Mutable? | Example |
|---|---|---|---|
| **Command** | Intent to change | Can be rejected | `PlaceOrder`, `CancelBooking` |
| **Event** | Fact that happened | Immutable | `OrderPlaced`, `BookingCancelled` |
| **Query** | Read-only request | Never mutates | `GetOrderById`, `ListActiveOrders` |

### 4. CQRS Split
- **Write Side**: Command → Aggregate validates → Event emitted → Stored in Event Store
- **Read Side**: Event consumed → Projection updated → Read model (DB/cache) queried

```
┌────────────┐    Command     ┌───────────────┐    Event      ┌─────────────┐
│   Client   │ ─────────────▶ │   Aggregate   │ ────────────▶ │ Event Store │
└────────────┘                └───────────────┘               └─────────────┘
                                                                      │
                                                               Event Published
                                                                      │
                                                                      ▼
┌────────────┐    Query      ┌───────────────┐   Update      ┌─────────────┐
│   Client   │ ─────────────▶│  Read Model   │ ◀──────────── │  Projector  │
└────────────┘                └───────────────┘               └─────────────┘
```

### 5. Projections
- A **Projection** listens to events and builds a denormalized read model (optimized for queries)
- Multiple projections can consume the same events for different read needs
- Projections are **rebuildable** at any time by replaying all events

### 6. Snapshots
- For aggregates with long event histories, store a **snapshot** every N events
- On rehydration: load latest snapshot + replay only newer events
- Snapshots are an optimization, never the source of truth

---

## Code Generation Rules

When generating any project with event sourcing, Claude MUST:

1. **Define domain events first** — before any other code
2. **Separate Command models from Event models** — never share DTOs
3. **Keep Aggregates pure** — no DB calls, no HTTP calls inside aggregate methods
4. **Use an append-only event store interface** — even if backed by a simple DB table
5. **Generate at least one Projection** per aggregate for the read side
6. **Version events from the start** — add a `version` or `schemaVersion` field to every event
7. **Name events in past tense** — `UserRegistered`, not `RegisterUser`
8. **Include event metadata** — `eventId`, `aggregateId`, `occurredAt`, `eventType`

---

## Mandatory File/Folder Structure

When scaffolding a project, always generate this layout:

```
src/
├── domain/
│   ├── events/          # Immutable event definitions
│   ├── commands/        # Command definitions (intent)
│   ├── aggregates/      # Aggregate root logic (pure)
│   └── value-objects/   # Immutable value types
├── application/
│   ├── command-handlers/  # Validate command → call aggregate → save events
│   └── query-handlers/    # Read from read models
├── infrastructure/
│   ├── event-store/       # Append-only persistence
│   ├── projections/       # Event → read model updaters
│   └── read-models/       # Optimized query repositories
└── api/
    ├── commands/          # HTTP endpoints that dispatch commands
    └── queries/           # HTTP endpoints that return read models
```

> For language-specific file templates, see `references/patterns.md`
> For folder conventions per framework, see `references/structure.md`

---

## Event Schema Standard

Every event MUST include this envelope:

```json
{
  "eventId": "uuid-v4",
  "eventType": "OrderPlaced",
  "eventVersion": 1,
  "aggregateId": "order-123",
  "aggregateType": "Order",
  "occurredAt": "2024-01-15T10:30:00Z",
  "payload": { }
}
```

---

## When NOT to Use Event Sourcing

Flag this to the user if the project is:
- A simple CRUD app with no audit requirements
- A read-heavy system with few state changes
- A prototype or MVP where speed of delivery outweighs architecture

In those cases, suggest **starting with clean domain events** (domain events pattern) without a full event store, as a stepping stone.

---

## Common Mistakes to Avoid

| ❌ Wrong | ✅ Right |
|---|---|
| Storing mutable state alongside events | Events only — derive state by replay |
| Aggregates querying the database | Aggregates are in-memory pure objects |
| Sharing Command and Event types | Separate classes/types for each |
| Present-tense event names (`CreateOrder`) | Past-tense (`OrderCreated`) |
| One giant projection for everything | One focused projection per use case |
| Forgetting event versioning | Add `eventVersion: 1` from day one |
| Updating events retroactively | Add new event versions, keep old ones |

---

## Quick Reference: What to Generate Per Feature

For every new **feature/domain concept**, generate:

- [ ] Event class(es) — what happened
- [ ] Command class(es) — what was requested  
- [ ] Aggregate — validates command, emits events, applies events to state
- [ ] Command Handler — orchestrates: load aggregate → handle command → save events
- [ ] Projection — listens to events, updates read model
- [ ] Read Model / Query Handler — serves the query side
- [ ] Event Store entry — append-only log

---

## Reference Files

| File | When to Read |
|---|---|
| `references/patterns.md` | Generating actual code — contains TypeScript, Python, Java, Go templates |
| `references/structure.md` | Scaffolding a new project — folder layouts per framework |
