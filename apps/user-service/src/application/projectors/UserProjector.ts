import { DomainEvent } from '../../domain/events/BaseEvent';
import { ReadModelStore, UserReadModel } from '../../infrastructure/read-models/ReadModelStore';

export class UserProjector {
  constructor(private readModelStore: ReadModelStore) {}

  async project(event: DomainEvent): Promise<void> {
    switch (event.eventType) {
      case 'UserRegistered':
        await this.projectUserRegistered(event);
        break;
      case 'UserProfileUpdated':
        await this.projectUserProfileUpdated(event);
        break;
    }
  }

  private async projectUserRegistered(event: DomainEvent): Promise<void> {
    const user: UserReadModel = {
      id: event.aggregateId,
      email: event.payload.email,
      role: event.payload.role,
      createdAt: event.metadata.occurredAt,
      updatedAt: event.metadata.occurredAt,
    };
    await this.readModelStore.saveUser(user);
  }

  private async projectUserProfileUpdated(event: DomainEvent): Promise<void> {
    const existing = await this.readModelStore.getUser(event.aggregateId);
    if (existing) {
      if (event.payload.name) existing.name = event.payload.name;
      if (event.payload.email) existing.email = event.payload.email;
      existing.updatedAt = event.metadata.occurredAt;
      await this.readModelStore.saveUser(existing);
    }
  }
}