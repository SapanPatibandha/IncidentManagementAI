import { DomainEvent } from '../../domain/events/BaseEvent';
import { ReadModelStore, NotificationReadModel } from '../../infrastructure/read-models/ReadModelStore';
import { Mailer } from '../../infrastructure/mailer/Mailer';

export class NotificationProjector {
  constructor(private readModelStore: ReadModelStore, private mailer: Mailer) {}

  async project(event: DomainEvent): Promise<void> {
    switch (event.eventType) {
      case 'NotificationCreated':
        await this.projectNotificationCreated(event);
        break;
    }
  }

  private async projectNotificationCreated(event: DomainEvent): Promise<void> {
    const notification: NotificationReadModel = {
      id: event.aggregateId,
      recipientId: event.payload.recipientId,
      title: event.payload.title,
      message: event.payload.message,
      channel: event.payload.channel,
      isRead: false,
      createdAt: event.metadata.occurredAt,
    };

    await this.readModelStore.saveNotification(notification);

    if (event.payload.channel === 'email' || event.payload.channel === 'both') {
      const recipientId = event.payload.recipientId;
      const to = recipientId.includes('@') ? recipientId : `${recipientId}@example.com`;
      const html = this.mailer.renderTemplate(event.payload.title, event.payload.message);
      await this.mailer.sendEmail(to, event.payload.title, html);
    }
  }
}
