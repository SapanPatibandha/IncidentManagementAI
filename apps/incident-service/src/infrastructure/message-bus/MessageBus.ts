import { connect, Connection, Channel } from 'amqplib';
import { env } from '../../config/env';
import { EventEnvelope, EXCHANGES } from '@incident-management-ai/event-contracts';
import { DomainEvent } from '../../domain/events/BaseEvent';

export class MessageBus {
  private connection!: Connection;
  private channel!: Channel;

  async connect(): Promise<void> {
    this.connection = await connect(env.RABBITMQ_URL);
    this.channel = await this.connection.createChannel();
    await this.channel.assertExchange(EXCHANGES.INCIDENT_EVENTS, 'topic', { durable: true });
  }

  async publish(event: DomainEvent): Promise<void> {
    if (!this.channel) throw new Error('MessageBus not connected');

    const envelope: EventEnvelope = {
      eventId: event.eventId,
      eventType: event.eventType,
      aggregateId: event.aggregateId,
      aggregateType: event.aggregateType,
      payload: event.payload,
      metadata: event.metadata,
    };

    const routingKey = this.getRoutingKey(event.eventType);
    this.channel.publish(EXCHANGES.INCIDENT_EVENTS, routingKey, Buffer.from(JSON.stringify(envelope)));
  }

  private getRoutingKey(eventType: string): string {
    switch (eventType) {
      case 'IncidentCreated':
        return 'incident.created';
      case 'StatusChanged':
        return 'incident.updated';
      case 'CommentAdded':
        return 'incident.updated';
      case 'IncidentAssigned':
        return 'incident.updated';
      default:
        return 'incident.updated';
    }
  }

  async close(): Promise<void> {
    if (this.channel) await this.channel.close();
    if (this.connection) await this.connection.close();
  }
}