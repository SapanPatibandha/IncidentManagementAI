import { DomainEvent } from '../events/BaseEvent';
import { NotificationCreated } from '../events/NotificationCreated';

export class NotificationAggregate {
  public id: string;
  public recipientId: string;
  public title: string;
  public message: string;
  public channel: 'in-app' | 'email' | 'both';
  public createdAt: Date;
  public isRead: boolean = false;
  private version: number = 0;

  constructor(id: string) {
    this.id = id;
    this.recipientId = '';
    this.title = '';
    this.message = '';
    this.channel = 'in-app';
    this.createdAt = new Date();
  }

  static rehydrate(id: string, events: DomainEvent[]): NotificationAggregate {
    const aggregate = new NotificationAggregate(id);
    for (const event of events) {
      aggregate.apply(event);
    }
    return aggregate;
  }

  handle(command: any): DomainEvent[] {
    switch (command.commandType) {
      case 'CreateNotification':
        return this.handleCreateNotification(command);
      default:
        throw new Error(`Unknown command: ${command.commandType}`);
    }
  }

  private handleCreateNotification(command: any): DomainEvent[] {
    const event = new NotificationCreated(this.id, command.payload, this.version + 1);
    this.apply(event);
    return [event];
  }

  apply(event: DomainEvent): void {
    this.version = event.metadata.version;

    switch (event.eventType) {
      case 'NotificationCreated':
        this.recipientId = event.payload.recipientId;
        this.title = event.payload.title;
        this.message = event.payload.message;
        this.channel = event.payload.channel;
        this.createdAt = event.metadata.occurredAt;
        break;
    }
  }
}
