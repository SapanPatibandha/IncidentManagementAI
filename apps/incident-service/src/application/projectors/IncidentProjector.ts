import { DomainEvent } from '../../domain/events/BaseEvent';
import { ReadModelStore, IncidentReadModel } from '../../infrastructure/read-models/ReadModelStore';

export class IncidentProjector {
  constructor(private readModelStore: ReadModelStore) {}

  async project(event: DomainEvent): Promise<void> {
    switch (event.eventType) {
      case 'IncidentCreated':
        await this.projectIncidentCreated(event);
        break;
      case 'StatusChanged':
        await this.projectStatusChanged(event);
        break;
      case 'IncidentAssigned':
        await this.projectIncidentAssigned(event);
        break;
    }
  }

  private async projectIncidentCreated(event: DomainEvent): Promise<void> {
    const incident: IncidentReadModel = {
      id: event.aggregateId,
      title: event.payload.title,
      description: event.payload.description,
      status: 'Open',
      priority: event.payload.priority,
      creatorId: event.payload.creatorId,
      createdAt: event.metadata.occurredAt,
      updatedAt: event.metadata.occurredAt,
    };
    await this.readModelStore.saveIncident(incident);
  }

  private async projectStatusChanged(event: DomainEvent): Promise<void> {
    const existing = await this.readModelStore.getIncident(event.aggregateId);
    if (existing) {
      existing.status = event.payload.toStatus;
      existing.updatedAt = event.metadata.occurredAt;
      await this.readModelStore.saveIncident(existing);
    }
  }

  private async projectIncidentAssigned(event: DomainEvent): Promise<void> {
    const existing = await this.readModelStore.getIncident(event.aggregateId);
    if (existing) {
      existing.assigneeId = event.payload.assigneeId;
      existing.updatedAt = event.metadata.occurredAt;
      await this.readModelStore.saveIncident(existing);
    }
  }
}