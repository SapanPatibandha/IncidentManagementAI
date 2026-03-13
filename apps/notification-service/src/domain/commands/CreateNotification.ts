import { DomainCommand } from './BaseCommand';

export class CreateNotification extends DomainCommand {
  constructor(
    aggregateId: string,
    payload: {
      recipientId: string;
      title: string;
      message: string;
      channel: 'in-app' | 'email' | 'both';
      metadata?: Record<string, any>;
    }
  ) {
    super(aggregateId, payload);
  }
}
