import { DomainEvent } from './BaseEvent';

export class NotificationCreated extends DomainEvent {
  constructor(
    aggregateId: string,
    payload: {
      recipientId: string;
      title: string;
      message: string;
      channel: 'in-app' | 'email' | 'both';
      metadata?: Record<string, any>;
    },
    version: number
  ) {
    super(aggregateId, payload, version);
  }
}
