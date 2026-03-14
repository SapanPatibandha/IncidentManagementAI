# Event Sourcing Project Structure Reference

Framework-specific folder layouts. Use the one matching the project.

## Table of Contents
1. [C#](#csharp)
2. [Go](#go)
3. [Java / Spring](#java)
4. [TypeScript / Node.js (NestJS or plain)](#nodejs)
5. [Python (FastAPI / Django)](#python)
6. [Database Schemas](#databases)

---

## C# {#csharp}

```
project-root/
├── src/
│   ├── Domain/
│   │   ├── Events/
│   │   │   ├── DomainEvent.cs         # Base domain event
│   │   │   ├── OrderPlacedEvent.cs
│   │   │   └── OrderConfirmedEvent.cs
│   │   ├── Commands/
│   │   │   ├── PlaceOrderCommand.cs
│   │   │   └── ConfirmOrderCommand.cs
│   │   ├── Aggregates/
│   │   │   ├── AggregateRoot.cs
│   │   │   └── Order.cs
│   │   └── ValueObjects/
│   │       └── Money.cs
│   ├── Application/
│   │   ├── CommandHandlers/
│   │   │   ├── PlaceOrderHandler.cs
│   │   │   └── ConfirmOrderHandler.cs
│   │   └── QueryHandlers/
│   │       └── GetOrderHandler.cs
│   ├── Infrastructure/
│   │   ├── EventStore/
│   │   │   ├── IEventStore.cs         # interface
│   │   │   ├── InMemoryEventStore.cs  # for tests
│   │   │   └── PostgresEventStore.cs  # production
│   │   ├── Projections/
│   │   │   └── OrderListProjection.cs
│   │   └── ReadModels/
│   │       └── OrderReadModel.cs
│   └── Api/
│       ├── Controllers/
│       │   ├── OrderCommandController.cs
│       │   └── OrderQueryController.cs
│       └── Startup.cs
├── tests/
│   ├── Unit/
│   │   └── Aggregates/
│   └── Integration/
└── IncidentManagementAI.sln
```

---

## Go {#go}

```
project-root/
├── internal/
│   ├── domain/
│   │   ├── events/
│   │   │   ├── event.go               # DomainEvent struct + constructor
│   │   │   └── order_events.go
│   │   ├── commands/
│   │   │   └── order_commands.go
│   │   ├── aggregates/
│   │   │   ├── aggregate.go           # AggregateRoot base
│   │   │   └── order.go
│   │   └── valueobjects/
│   │       └── money.go
│   ├── application/
│   │   ├── handlers/
│   │   │   ├── place_order.go
│   │   │   └── get_order.go
│   │   └── ports/
│   │       └── event_store.go         # Interface (port)
│   └── infrastructure/
│       ├── eventstore/
│       │   ├── inmemory.go
│       │   └── postgres.go
│       ├── projections/
│       │   └── order_list.go
│       └── readmodels/
│           └── order_repo.go
├── cmd/
│   └── api/
│       └── main.go
└── go.mod
```

---

## Java Spring Boot {#java}

```
project-root/
├── src/
│   └── main/
│       └── java/
│           └── com/yourapp/
│               ├── domain/
│               │   ├── events/
│               │   │   ├── DomainEvent.java      # record/interface
│               │   │   └── order/
│               │   │       ├── OrderPlaced.java
│               │   │       └── OrderConfirmed.java
│               │   ├── commands/
│               │   │   └── order/
│               │   │       └── PlaceOrderCommand.java
│               │   └── aggregates/
│               │       ├── AggregateRoot.java
│               │       └── Order.java
│               ├── application/
│               │   ├── commandhandlers/
│               │   │   └── PlaceOrderHandler.java
│               │   └── queryhandlers/
│               │       └── GetOrderHandler.java
│               ├── infrastructure/
│               │   ├── eventstore/
│               │   │   ├── EventStore.java        # interface
│               │   │   └── JdbcEventStore.java
│               │   ├── projections/
│               │   │   └── OrderListProjection.java
│               │   └── readmodels/
│               │       └── OrderReadRepository.java
│               └── api/
│                   ├── OrderCommandController.java
│                   └── OrderQueryController.java
└── pom.xml / build.gradle
```

---

## TypeScript / Node.js {#nodejs}

```
project-root/
├── src/
│   ├── domain/
│   │   ├── events/
│   │   │   ├── base-event.ts           # DomainEvent interface + factory
│   │   │   ├── order-placed.event.ts
│   │   │   └── order-confirmed.event.ts
│   │   ├── commands/
│   │   │   ├── place-order.command.ts
│   │   │   └── confirm-order.command.ts
│   │   ├── aggregates/
│   │   │   ├── aggregate-root.ts       # Abstract base class
│   │   │   └── order.aggregate.ts
│   │   └── value-objects/
│   │       ├── money.vo.ts
│   │       └── order-id.vo.ts
│   ├── application/
│   │   ├── command-handlers/
│   │   │   ├── place-order.handler.ts
│   │   │   └── confirm-order.handler.ts
│   │   └── query-handlers/
│   │       ├── get-order.handler.ts
│   │       └── list-orders.handler.ts
│   ├── infrastructure/
│   │   ├── event-store/
│   │   │   ├── event-store.interface.ts
│   │   │   ├── in-memory-event-store.ts   # For tests
│   │   │   └── postgres-event-store.ts    # Production
│   │   ├── projections/
│   │   │   ├── order-list.projection.ts
│   │   │   └── order-detail.projection.ts
│   │   └── read-models/
│   │       └── order.read-model.ts
│   └── api/
│       ├── commands/
│       │   └── orders.controller.ts     # POST /orders, POST /orders/:id/confirm
│   │       └── queries/
│       │           └── orders.query.controller.ts # GET /orders, GET /orders/:id
├── tests/
│   ├── unit/
│   │   └── aggregates/
│   └── integration/
│       └── event-store/
├── package.json
└── tsconfig.json
```

**NestJS module structure** — each domain becomes a module:
```
src/orders/
├── orders.module.ts
├── domain/
├── application/
└── infrastructure/
```

---

## Python (FastAPI) {#python}

```
project-root/
├── src/
│   ├── domain/
│   │   ├── __init__.py
│   │   ├── events/
│   │   │   ├── base_event.py
│   │   │   └── order_events.py        # OrderPlaced, OrderConfirmed, etc.
│   │   ├── commands/
│   │   │   └── order_commands.py      # PlaceOrder, ConfirmOrder dataclasses
│   │   ├── aggregates/
│   │   │   ├── aggregate_root.py
│   │   │   └── order.py
│   │   └── value_objects/
│   │       └── money.py
│   ├── application/
│   │   ├── command_handlers/
│   │   │   └── order_command_handlers.py
│   │   └── query_handlers/
│   │       └── order_query_handlers.py
│   ├── infrastructure/
│   │   ├── event_store/
│   │   │   ├── base.py                # Abstract EventStore
│   │   │   ├── in_memory.py
│   │   │   └── postgres.py
│   │   ├── projections/
│   │   │   └── order_projection.py
│   │   └── read_models/
│   │       └── order_read_model.py
│   └── api/
│       ├── main.py                    # FastAPI app
│       ├── routers/
│       │   ├── order_commands.py      # POST endpoints
│       │   └── order_queries.py       # GET endpoints
│       └── dependencies.py            # DI wiring
├── tests/
│   ├── unit/
│   └── integration/
├── pyproject.toml
└── requirements.txt
```

---

## Database Schemas {#databases}

### Event Store Table (PostgreSQL)
```sql
CREATE TABLE event_store (
    id            BIGSERIAL PRIMARY KEY,
    event_id      UUID NOT NULL UNIQUE,
    event_type    VARCHAR(255) NOT NULL,
    event_version INT NOT NULL DEFAULT 1,
    aggregate_id  VARCHAR(255) NOT NULL,
    aggregate_type VARCHAR(255) NOT NULL,
    aggregate_version INT NOT NULL,
    occurred_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    payload       JSONB NOT NULL,
    metadata      JSONB
);

CREATE INDEX idx_event_store_aggregate ON event_store (aggregate_id, aggregate_version);
CREATE INDEX idx_event_store_type ON event_store (event_type);
CREATE INDEX idx_event_store_occurred ON event_store (occurred_at);

-- Optimistic concurrency: ensure no two events share same aggregate+version
ALTER TABLE event_store
    ADD CONSTRAINT uq_aggregate_version UNIQUE (aggregate_id, aggregate_version);
```

### Snapshots Table
```sql
CREATE TABLE aggregate_snapshots (
    id              BIGSERIAL PRIMARY KEY,
    aggregate_id    VARCHAR(255) NOT NULL,
    aggregate_type  VARCHAR(255) NOT NULL,
    version         INT NOT NULL,
    state           JSONB NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_snapshot UNIQUE (aggregate_id, version)
);
```

### Read Model Example (Orders projection)
```sql
CREATE TABLE order_read_model (
    order_id     UUID PRIMARY KEY,
    customer_id  UUID NOT NULL,
    status       VARCHAR(50) NOT NULL,
    total_amount NUMERIC(10,2),
    item_count   INT,
    created_at   TIMESTAMPTZ NOT NULL,
    updated_at   TIMESTAMPTZ NOT NULL
);
```

### MongoDB Collections
```javascript
// event_store collection
{
  _id: ObjectId,
  eventId: String,        // UUID, unique index
  eventType: String,
  eventVersion: Number,
  aggregateId: String,    // compound index: aggregateId + aggregateVersion
  aggregateType: String,
  aggregateVersion: Number,
  occurredAt: ISODate,
  payload: Object
}

// Index
db.event_store.createIndex({ aggregateId: 1, aggregateVersion: 1 }, { unique: true })
```
