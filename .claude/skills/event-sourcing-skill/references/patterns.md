# Event Sourcing Code Patterns

Language-specific templates for Event Sourcing + CQRS. Use the section matching the project's language.

## Table of Contents
1. [C#](#csharp)
2. [Go](#go)
3. [Java / Spring](#java)
4. [TypeScript / Node.js](#typescript)
5. [Python](#python)

---

## C# {#csharp}

### Domain Event Base Class
```csharp
// Domain/Events/DomainEvent.cs
using System;

public abstract class DomainEvent
{
    public Guid EventId { get; private set; }
    public string EventType { get; private set; }
    public int EventVersion { get; private set; }
    public Guid AggregateId { get; private set; }
    public string AggregateType { get; private set; }
    public DateTime OccurredAt { get; private set; }
    public object Payload { get; private set; }

    protected DomainEvent(Guid aggregateId, string aggregateType, object payload, int version = 1)
    {
        EventId = Guid.NewGuid();
        EventType = GetType().Name;
        EventVersion = version;
        AggregateId = aggregateId;
        AggregateType = aggregateType;
        OccurredAt = DateTime.UtcNow;
        Payload = payload;
    }
}
```

### Aggregate Root Base Class
```csharp
// Domain/Aggregates/AggregateRoot.cs
using System.Collections.Generic;

public abstract class AggregateRoot
{
    private readonly List<DomainEvent> _uncommittedEvents = new List<DomainEvent>();
    public int Version { get; private set; }

    public IReadOnlyCollection<DomainEvent> UncommittedEvents => _uncommittedEvents.AsReadOnly();

    protected void Apply(DomainEvent @event)
    {
        When(@event);
        _uncommittedEvents.Add(@event);
        Version++;
    }

    public void LoadFromHistory(IEnumerable<DomainEvent> events)
    {
        foreach (var @event in events)
        {
            When(@event);
            Version++;
        }
    }

    public void ClearUncommittedEvents()
    {
        _uncommittedEvents.Clear();
    }

    protected abstract void When(DomainEvent @event);
}
```

### Example Aggregate (Order)
```csharp
// Domain/Aggregates/Order.cs
using System;
using System.Collections.Generic;

public enum OrderStatus
{
    Pending,
    Confirmed,
    Shipped,
    Cancelled
}

public class OrderPlacedEvent : DomainEvent
{
    public string CustomerId { get; }
    public List<OrderItem> Items { get; }

    public OrderPlacedEvent(Guid orderId, string customerId, List<OrderItem> items)
        : base(orderId, "Order", new { CustomerId = customerId, Items = items })
    {
        CustomerId = customerId;
        Items = items;
    }
}

public class OrderConfirmedEvent : DomainEvent
{
    public OrderConfirmedEvent(Guid orderId) : base(orderId, "Order", null) { }
}

public class OrderCancelledEvent : DomainEvent
{
    public string Reason { get; }

    public OrderCancelledEvent(Guid orderId, string reason) : base(orderId, "Order", new { Reason = reason })
    {
        Reason = reason;
    }
}

public class OrderItem
{
    public string ProductId { get; }
    public int Quantity { get; }
    public decimal Price { get; }

    public OrderItem(string productId, int quantity, decimal price)
    {
        ProductId = productId;
        Quantity = quantity;
        Price = price;
    }
}

public class Order : AggregateRoot
{
    public Guid Id { get; private set; }
    public OrderStatus Status { get; private set; }
    public string CustomerId { get; private set; }
    public List<OrderItem> Items { get; private set; } = new List<OrderItem>();

    public static Order Place(Guid orderId, string customerId, List<OrderItem> items)
    {
        var order = new Order();
        order.Apply(new OrderPlacedEvent(orderId, customerId, items));
        return order;
    }

    public void Confirm()
    {
        if (Status != OrderStatus.Pending)
        {
            throw new InvalidOperationException($"Cannot confirm order in status: {Status}");
        }
        Apply(new OrderConfirmedEvent(Id));
    }

    public void Cancel(string reason)
    {
        if (Status == OrderStatus.Shipped)
        {
            throw new InvalidOperationException("Cannot cancel a shipped order");
        }
        Apply(new OrderCancelledEvent(Id, reason));
    }

    protected override void When(DomainEvent @event)
    {
        switch (@event)
        {
            case OrderPlacedEvent e:
                Id = e.AggregateId;
                CustomerId = e.CustomerId;
                Items = e.Items;
                Status = OrderStatus.Pending;
                break;
            case OrderConfirmedEvent:
                Status = OrderStatus.Confirmed;
                break;
            case OrderCancelledEvent:
                Status = OrderStatus.Cancelled;
                break;
        }
    }
}
```

### Event Store Interface
```csharp
// Infrastructure/EventStore/IEventStore.cs
using System.Collections.Generic;
using System.Threading.Tasks;

public interface IEventStore
{
    Task AppendAsync(Guid aggregateId, IEnumerable<DomainEvent> events, int expectedVersion);
    Task<IEnumerable<DomainEvent>> LoadAsync(Guid aggregateId);
    Task<IEnumerable<DomainEvent>> LoadFromVersionAsync(Guid aggregateId, int fromVersion);
}
```

### In-Memory Event Store
```csharp
// Infrastructure/EventStore/InMemoryEventStore.cs
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

public class InMemoryEventStore : IEventStore
{
    private readonly ConcurrentDictionary<Guid, List<DomainEvent>> _streams = new();

    public Task AppendAsync(Guid aggregateId, IEnumerable<DomainEvent> events, int expectedVersion)
    {
        var stream = _streams.GetOrAdd(aggregateId, _ => new List<DomainEvent>());
        if (stream.Count != expectedVersion)
        {
            throw new ConcurrencyException($"Concurrency conflict on aggregate {aggregateId}");
        }
        stream.AddRange(events);
        return Task.CompletedTask;
    }

    public Task<IEnumerable<DomainEvent>> LoadAsync(Guid aggregateId)
    {
        return Task.FromResult(_streams.TryGetValue(aggregateId, out var events) ? events.AsEnumerable() : Enumerable.Empty<DomainEvent>());
    }

    public Task<IEnumerable<DomainEvent>> LoadFromVersionAsync(Guid aggregateId, int fromVersion)
    {
        if (!_streams.TryGetValue(aggregateId, out var events))
        {
            return Task.FromResult(Enumerable.Empty<DomainEvent>());
        }
        return Task.FromResult(events.Skip(fromVersion).AsEnumerable());
    }
}

public class ConcurrencyException : Exception
{
    public ConcurrencyException(string message) : base(message) { }
}
```

### Command Handler
```csharp
// Application/CommandHandlers/PlaceOrderHandler.cs
using System.Threading.Tasks;

public class PlaceOrderCommand
{
    public Guid OrderId { get; }
    public string CustomerId { get; }
    public List<OrderItem> Items { get; }

    public PlaceOrderCommand(Guid orderId, string customerId, List<OrderItem> items)
    {
        OrderId = orderId;
        CustomerId = customerId;
        Items = items;
    }
}

public class PlaceOrderHandler
{
    private readonly IEventStore _eventStore;

    public PlaceOrderHandler(IEventStore eventStore)
    {
        _eventStore = eventStore;
    }

    public async Task HandleAsync(PlaceOrderCommand command)
    {
        var order = Order.Place(command.OrderId, command.CustomerId, command.Items);
        await _eventStore.AppendAsync(command.OrderId, order.UncommittedEvents, 0);
        order.ClearUncommittedEvents();
    }
}
```

## Go {#go}

### Event Base
```go
// domain/events/event.go
package events

import (
    "time"
    "github.com/google/uuid"
)

type DomainEvent struct {
    EventID       string         `json:"eventId"`
    EventType     string         `json:"eventType"`
    EventVersion  int            `json:"eventVersion"`
    AggregateID   string         `json:"aggregateId"`
    AggregateType string         `json:"aggregateType"`
    OccurredAt    time.Time      `json:"occurredAt"`
    Payload       map[string]any `json:"payload"`
}

func NewEvent(eventType, aggregateID, aggregateType string, payload map[string]any) DomainEvent {
    return DomainEvent{
        EventID:       uuid.NewString(),
        EventType:     eventType,
        EventVersion:  1,
        AggregateID:   aggregateID,
        AggregateType: aggregateType,
        OccurredAt:    time.Now().UTC(),
        Payload:       payload,
    }
}
```

### Aggregate Interface
```go
// domain/aggregates/aggregate.go
package aggregates

import "domain/events"

type AggregateRoot struct {
    uncommitted []events.DomainEvent
    Version     int
}

func (a *AggregateRoot) Apply(event events.DomainEvent, handler func(events.DomainEvent)) {
    handler(event)
    a.uncommitted = append(a.uncommitted, event)
    a.Version++
}

func (a *AggregateRoot) LoadFromHistory(evts []events.DomainEvent, handler func(events.DomainEvent)) {
    for _, e := range evts {
        handler(e)
        a.Version++
    }
}

func (a *AggregateRoot) UncommittedEvents() []events.DomainEvent { return a.uncommitted }
func (a *AggregateRoot) ClearEvents()                            { a.uncommitted = nil }
```

## Java / Spring {#java}

### Event Base
```java
// domain/events/DomainEvent.java
public record DomainEvent(
    String eventId,
    String eventType,
    int eventVersion,
    String aggregateId,
    String aggregateType,
    Instant occurredAt,
    Map<String, Object> payload
) {
    public static DomainEvent of(String eventType, String aggregateId, 
                                  String aggregateType, Map<String, Object> payload) {
        return new DomainEvent(
            UUID.randomUUID().toString(), eventType, 1,
            aggregateId, aggregateType, Instant.now(), payload
        );
    }
}
```

### Aggregate Base
```java
// domain/aggregates/AggregateRoot.java
public abstract class AggregateRoot {
    private final List<DomainEvent> uncommittedEvents = new ArrayList<>();
    protected int version = 0;

    protected void apply(DomainEvent event) {
        when(event);
        uncommittedEvents.add(event);
        version++;
    }

    public void loadFromHistory(List<DomainEvent> events) {
        events.forEach(e -> { when(e); version++; });
    }

    public List<DomainEvent> getUncommittedEvents() { return List.copyOf(uncommittedEvents); }
    public void clearUncommittedEvents() { uncommittedEvents.clear(); }
    protected abstract void when(DomainEvent event);
}
```

## TypeScript / Node.js {#typescript}

### Event Base Type
```typescript
// domain/events/base-event.ts
export interface DomainEvent {
  eventId: string;
  eventType: string;
  eventVersion: number;
  aggregateId: string;
  aggregateType: string;
  occurredAt: Date;
  payload: Record<string, unknown>;
}

export function createEvent<T>(
  eventType: string,
  aggregateId: string,
  aggregateType: string,
  payload: T,
  version = 1
): DomainEvent {
  return {
    eventId: crypto.randomUUID(),
    eventType,
    eventVersion: version,
    aggregateId,
    aggregateType,
    occurredAt: new Date(),
    payload: payload as Record<string, unknown>,
  };
}
```

### Aggregate Base Class
```typescript
// domain/aggregates/aggregate-root.ts
import { DomainEvent } from '../events/base-event';

export abstract class AggregateRoot {
  private _uncommittedEvents: DomainEvent[] = [];
  protected version = 0;

  get uncommittedEvents(): DomainEvent[] {
    return [...this._uncommittedEvents];
  }

  protected apply(event: DomainEvent): void {
    this.when(event);
    this._uncommittedEvents.push(event);
    this.version++;
  }

  loadFromHistory(events: DomainEvent[]): void {
    for (const event of events) {
      this.when(event);
      this.version++;
    }
  }

  clearUncommittedEvents(): void {
    this._uncommittedEvents = [];
  }

  protected abstract when(event: DomainEvent): void;
}
```

### Example Aggregate (Order)
```typescript
// domain/aggregates/order.aggregate.ts
import { AggregateRoot } from './aggregate-root';
import { DomainEvent, createEvent } from '../events/base-event';

export type OrderStatus = 'pending' | 'confirmed' | 'shipped' | 'cancelled';

interface PlaceOrderCommand {
  orderId: string;
  customerId: string;
  items: Array<{ productId: string; quantity: number; price: number }>;
}

export class Order extends AggregateRoot {
  private id!: string;
  private status!: OrderStatus;
  private customerId!: string;

  static place(command: PlaceOrderCommand): Order {
    const order = new Order();
    order.apply(
      createEvent('OrderPlaced', command.orderId, 'Order', {
        customerId: command.customerId,
        items: command.items,
      })
    );
    return order;
  }

  confirm(): void {
    if (this.status !== 'pending') {
      throw new Error(`Cannot confirm order in status: ${this.status}`);
    }
    this.apply(createEvent('OrderConfirmed', this.id, 'Order', {}));
  }

  cancel(reason: string): void {
    if (this.status === 'shipped') {
      throw new Error('Cannot cancel a shipped order');
    }
    this.apply(createEvent('OrderCancelled', this.id, 'Order', { reason }));
  }

  protected when(event: DomainEvent): void {
    switch (event.eventType) {
      case 'OrderPlaced':
        this.id = event.aggregateId;
        this.customerId = (event.payload as any).customerId;
        this.status = 'pending';
        break;
      case 'OrderConfirmed':
        this.status = 'confirmed';
        break;
      case 'OrderCancelled':
        this.status = 'cancelled';
        break;
    }
  }
}
```

### Event Store Interface
```typescript
// infrastructure/event-store/event-store.interface.ts
import { DomainEvent } from '../../domain/events/base-event';

export interface EventStore {
  append(aggregateId: string, events: DomainEvent[], expectedVersion: number): Promise<void>;
  load(aggregateId: string): Promise<DomainEvent[]>;
  loadFromVersion(aggregateId: string, fromVersion: number): Promise<DomainEvent[]>;
}
```

### In-Memory Event Store (for testing/dev)
```typescript
// infrastructure/event-store/in-memory-event-store.ts
import { DomainEvent } from '../../domain/events/base-event';
import { EventStore } from './event-store.interface';

export class InMemoryEventStore implements EventStore {
  private streams = new Map<string, DomainEvent[]>();

  async append(aggregateId: string, events: DomainEvent[], expectedVersion: number): Promise<void> {
    const existing = this.streams.get(aggregateId) ?? [];
    if (existing.length !== expectedVersion) {
      throw new Error(`Concurrency conflict on aggregate ${aggregateId}`);
    }
    this.streams.set(aggregateId, [...existing, ...events]);
  }

  async load(aggregateId: string): Promise<DomainEvent[]> {
    return this.streams.get(aggregateId) ?? [];
  }

  async loadFromVersion(aggregateId: string, fromVersion: number): Promise<DomainEvent[]> {
    const events = this.streams.get(aggregateId) ?? [];
    return events.slice(fromVersion);
  }
}
```

### Command Handler
```typescript
// application/command-handlers/place-order.handler.ts
import { Order } from '../../domain/aggregates/order.aggregate';
import { EventStore } from '../../infrastructure/event-store/event-store.interface';

export class PlaceOrderHandler {
  constructor(private readonly eventStore: EventStore) {}

  async handle(command: { orderId: string; customerId: string; items: any[] }): Promise<void> {
    const order = Order.place(command);
    await this.eventStore.append(command.orderId, order.uncommittedEvents, 0);
    order.clearUncommittedEvents();
  }
}
```

### Projection
```typescript
// infrastructure/projections/order-list.projection.ts
import { DomainEvent } from '../../domain/events/base-event';

interface OrderSummary {
  orderId: string;
  customerId: string;
  status: string;
  createdAt: Date;
}

export class OrderListProjection {
  private orders = new Map<string, OrderSummary>();

  project(event: DomainEvent): void {
    switch (event.eventType) {
      case 'OrderPlaced':
        this.orders.set(event.aggregateId, {
          orderId: event.aggregateId,
          customerId: (event.payload as any).customerId,
          status: 'pending',
          createdAt: event.occurredAt,
        });
        break;
      case 'OrderConfirmed':
        const order = this.orders.get(event.aggregateId);
        if (order) order.status = 'confirmed';
        break;
      case 'OrderCancelled':
        const o = this.orders.get(event.aggregateId);
        if (o) o.status = 'cancelled';
        break;
    }
  }

  getAll(): OrderSummary[] {
    return Array.from(this.orders.values());
  }

  getById(id: string): OrderSummary | undefined {
    return this.orders.get(id);
  }
}
```

## Python {#python}

### Event Base
```python
# domain/events/base_event.py
from dataclasses import dataclass, field
from datetime import datetime, UTC
from uuid import uuid4
from typing import Any

@dataclass(frozen=True)
class DomainEvent:
    event_type: str
    aggregate_id: str
    aggregate_type: str
    payload: dict[str, Any]
    event_id: str = field(default_factory=lambda: str(uuid4()))
    event_version: int = 1
    occurred_at: datetime = field(default_factory=lambda: datetime.now(UTC))
```

### Aggregate Base
```python
# domain/aggregates/aggregate_root.py
from abc import ABC, abstractmethod
from domain.events.base_event import DomainEvent

class AggregateRoot(ABC):
    def __init__(self):
        self._uncommitted_events: list[DomainEvent] = []
        self.version = 0

    def _apply(self, event: DomainEvent) -> None:
        self._when(event)
        self._uncommitted_events.append(event)
        self.version += 1

    def load_from_history(self, events: list[DomainEvent]) -> None:
        for event in events:
            self._when(event)
            self.version += 1

    def clear_uncommitted_events(self) -> list[DomainEvent]:
        events = self._uncommitted_events.copy()
        self._uncommitted_events.clear()
        return events

    @abstractmethod
    def _when(self, event: DomainEvent) -> None:
        pass
```

### Example Aggregate
```python
# domain/aggregates/order.py
from domain.aggregates.aggregate_root import AggregateRoot
from domain.events.base_event import DomainEvent

class Order(AggregateRoot):
    def __init__(self):
        super().__init__()
        self.id = None
        self.status = None
        self.customer_id = None

    @classmethod
    def place(cls, order_id: str, customer_id: str, items: list) -> "Order":
        order = cls()
        order._apply(DomainEvent(
            event_type="OrderPlaced",
            aggregate_id=order_id,
            aggregate_type="Order",
            payload={"customer_id": customer_id, "items": items},
        ))
        return order

    def confirm(self) -> None:
        if self.status != "pending":
            raise ValueError(f"Cannot confirm order in status: {self.status}")
        self._apply(DomainEvent(
            event_type="OrderConfirmed",
            aggregate_id=self.id,
            aggregate_type="Order",
            payload={},
        ))

    def _when(self, event: DomainEvent) -> None:
        match event.event_type:
            case "OrderPlaced":
                self.id = event.aggregate_id
                self.customer_id = event.payload["customer_id"]
                self.status = "pending"
            case "OrderConfirmed":
                self.status = "confirmed"
            case "OrderCancelled":
                self.status = "cancelled"
```
