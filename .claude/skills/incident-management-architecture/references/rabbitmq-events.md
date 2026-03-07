# RabbitMQ Event Catalog

Complete catalog of all domain events published to the `incident.events` topic exchange.
Every event uses the standard envelope from the `event-sourcing` skill.

**Exchange name:** `incident.events`  
**Exchange type:** `topic`  
**Durability:** durable (survives broker restart)

---

## Routing Key Convention

```
<source-service>.<aggregate-type>.<EventName>
```

Examples:
- `auth.user.UserRegistered`
- `incident.incident.IncidentCreated`
- `incident.incident.IncidentStatusChanged`

---

## Standard Event Envelope (all events)

```json
{
  "eventId": "uuid-v4",
  "eventType": "IncidentCreated",
  "eventVersion": 1,
  "aggregateId": "incident-uuid",
  "aggregateType": "Incident",
  "occurredAt": "2024-01-15T10:30:00Z",
  "metadata": {
    "userId": "uuid",
    "correlationId": "uuid",
    "causationId": "uuid"
  },
  "payload": { }
}
```

---

## Auth Service Events

### `UserRegistered`
**Routing key:** `auth.user.UserRegistered`
**Consumed by:** notification-service, user-service
```json
{
  "payload": {
    "userId": "uuid",
    "email": "user@example.com",
    "name": "Jane Smith",
    "role": "IncidentCreator"
  }
}
```

### `PasswordResetRequested`
**Routing key:** `auth.user.PasswordResetRequested`
**Consumed by:** notification-service
```json
{
  "payload": {
    "userId": "uuid",
    "email": "user@example.com",
    "resetToken": "hashed-token",
    "expiresAt": "2024-01-15T11:30:00Z"
  }
}
```

---

## Incident Service Events

### `IncidentCreated`
**Routing key:** `incident.incident.IncidentCreated`
**Consumed by:** notification-service, analytics-service, user-service (workload tracking)
```json
{
  "payload": {
    "incidentId": "uuid",
    "title": "Login page 500 error",
    "description": "...",
    "priority": "High",
    "tags": ["frontend", "auth"],
    "creatorId": "uuid",
    "creatorName": "Jane Smith",
    "status": "Open"
  }
}
```

### `IncidentAssigned`
**Routing key:** `incident.incident.IncidentAssigned`
**Consumed by:** notification-service, analytics-service, user-service
```json
{
  "payload": {
    "incidentId": "uuid",
    "title": "...",
    "assignedToId": "uuid",
    "assignedToName": "Bob Engineer",
    "assignedById": "uuid",
    "previousAssigneeId": null
  }
}
```

### `IncidentStatusChanged`
**Routing key:** `incident.incident.IncidentStatusChanged`
**Consumed by:** notification-service, analytics-service
```json
{
  "payload": {
    "incidentId": "uuid",
    "title": "...",
    "fromStatus": "Open",
    "toStatus": "In-Process",
    "changedById": "uuid",
    "changedByName": "Bob Engineer",
    "changedByRole": "IssueResponder",
    "comment": "Starting investigation"
  }
}
```

### `CommentAdded`
**Routing key:** `incident.incident.CommentAdded`
**Consumed by:** notification-service
```json
{
  "payload": {
    "incidentId": "uuid",
    "commentId": "uuid",
    "authorId": "uuid",
    "authorName": "Jane Smith",
    "authorRole": "IncidentCreator",
    "content": "Any update on this?",
    "creatorId": "uuid",
    "assigneeId": "uuid"
  }
}
```

### `IncidentClosed`
**Routing key:** `incident.incident.IncidentClosed`
**Consumed by:** notification-service, analytics-service, user-service
```json
{
  "payload": {
    "incidentId": "uuid",
    "closedById": "uuid",
    "closedByRole": "IssueResponder",
    "resolutionComment": "Fixed in deploy v1.2.3",
    "openedAt": "2024-01-14T10:00:00Z",
    "closedAt": "2024-01-15T10:30:00Z",
    "resolutionHours": 24.5
  }
}
```

### `IncidentReopened`
**Routing key:** `incident.incident.IncidentReopened`
**Consumed by:** notification-service, analytics-service
```json
{
  "payload": {
    "incidentId": "uuid",
    "reopenedById": "uuid",
    "reopenedByRole": "IncidentCreator",
    "reason": "Issue recurred after deploy"
  }
}
```

### `IncidentEscalated`
**Routing key:** `incident.incident.IncidentEscalated`
**Consumed by:** notification-service, analytics-service
```json
{
  "payload": {
    "incidentId": "uuid",
    "title": "...",
    "escalationReason": "SLA_BREACH",
    "hoursOpen": 25,
    "currentAssigneeId": "uuid",
    "adminNotified": true
  }
}
```

---

## User Service Events

### `ResponderAvailabilitySet`
**Routing key:** `user.user.ResponderAvailabilitySet`
**Consumed by:** incident-service (for auto-routing logic)
```json
{
  "payload": {
    "userId": "uuid",
    "isAvailable": false,
    "reason": "On leave"
  }
}
```

---

## Queue Bindings Summary

| Consumer Service       | Queue Name                     | Bound Routing Keys                                                                 |
|------------------------|-------------------------------|------------------------------------------------------------------------------------|
| notification-service   | `notifications.queue`          | `incident.incident.*`, `auth.user.UserRegistered`, `auth.user.PasswordResetRequested` |
| analytics-service      | `analytics.queue`              | `incident.incident.*`                                                              |
| user-service           | `userservice.queue`            | `auth.user.UserRegistered`, `incident.incident.IncidentAssigned`, `incident.incident.IncidentClosed` |
| incident-service       | `incidentservice.queue`        | `user.user.ResponderAvailabilitySet`                                               |

---

## Dead Letter Queue (DLQ) Strategy

- Every queue has a corresponding DLQ: `<queue-name>.dlq`
- Messages failing processing after 3 retries go to DLQ
- DLQ messages are logged and alerted for manual review
- Configure with: `x-dead-letter-exchange` + `x-message-ttl`

```typescript
// Example queue declaration with DLQ
channel.assertQueue('notifications.queue', {
  durable: true,
  arguments: {
    'x-dead-letter-exchange': 'incident.events.dlx',
    'x-dead-letter-routing-key': 'notifications.queue.dlq',
    'x-message-ttl': 30000 // retry after 30s
  }
});
```
