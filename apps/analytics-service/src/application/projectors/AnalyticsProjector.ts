import { EventEnvelope } from '@incident-management-ai/event-contracts';
import { ReadModelStore } from '../../infrastructure/read-models/ReadModelStore';

export class AnalyticsProjector {
  constructor(private readonly store: ReadModelStore) {}

  async project(event: EventEnvelope): Promise<void> {
    switch (event.eventType) {
      case 'IncidentCreated':
        await this.handleIncidentCreated(event);
        break;
      case 'IncidentAssigned':
        await this.handleIncidentAssigned(event);
        break;
      case 'StatusChanged':
        await this.handleStatusChanged(event);
        break;
      default:
        // ignore other events
        break;
    }
  }

  private async handleIncidentCreated(event: EventEnvelope): Promise<void> {
    await this.store.upsertIncidentMetric({
      incidentId: event.aggregateId,
      creatorId: event.payload.creatorId,
      assigneeId: null,
      status: 'Open',
      createdAt: new Date(event.metadata.occurredAt),
      closedAt: null,
      escalationCount: 0,
      lastUpdated: new Date(event.metadata.occurredAt),
    });
  }

  private async handleIncidentAssigned(event: EventEnvelope): Promise<void> {
    const existing = await this.store.getIncidentMetric(event.aggregateId);
    if (!existing) {
      // if we haven't seen the create event yet, insert partial record with minimum fields
      await this.store.upsertIncidentMetric({
        incidentId: event.aggregateId,
        creatorId: '',
        assigneeId: event.payload.assigneeId,
        status: 'Open',
        createdAt: new Date(event.metadata.occurredAt),
        closedAt: null,
        escalationCount: 0,
        lastUpdated: new Date(event.metadata.occurredAt),
      });
      return;
    }

    await this.store.upsertIncidentMetric({
      ...existing,
      assigneeId: event.payload.assigneeId,
      lastUpdated: new Date(event.metadata.occurredAt),
    });
  }

  private async handleStatusChanged(event: EventEnvelope): Promise<void> {
    const existing = await this.store.getIncidentMetric(event.aggregateId);
    const toStatus = event.payload.toStatus as string;
    const updated: any = {
      ...existing,
      status: toStatus,
      lastUpdated: new Date(event.metadata.occurredAt),
    };

    if (toStatus === 'Closed') {
      updated.closedAt = new Date(event.metadata.occurredAt);
    }

    if (!existing) {
      // Ensure minimal required fields exist
      updated.incidentId = event.aggregateId;
      updated.creatorId = '';
      updated.createdAt = new Date(event.metadata.occurredAt);
      updated.escalationCount = 0;
    }

    await this.store.upsertIncidentMetric(updated);
  }
}
