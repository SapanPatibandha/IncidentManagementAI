import { connect } from 'amqplib';
import { env } from '../../config/env';
import { EventEnvelope, EXCHANGES } from '@incident-management-ai/event-contracts';

export class MessageBus {
  private connection!: any;
  private channel!: any;

  async connect(): Promise<void> {
    this.connection = await connect(env.RABBITMQ_URL);
    this.channel = await this.connection.createChannel();
    await this.channel.assertExchange(EXCHANGES.INCIDENT_EVENTS, 'topic', { durable: true });
  }

  async subscribe(
    routingKeys: string[],
    handler: (envelope: EventEnvelope) => Promise<void>,
    queueName = 'analytics.queue'
  ): Promise<void> {
    if (!this.channel) throw new Error('MessageBus not connected');

    const q = await this.channel.assertQueue(queueName, {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': `${EXCHANGES.INCIDENT_EVENTS}.dlx`,
        'x-dead-letter-routing-key': `${queueName}.dlq`,
        'x-message-ttl': 30000,
      },
    });

    for (const key of routingKeys) {
      await this.channel.bindQueue(q.queue, EXCHANGES.INCIDENT_EVENTS, key);
    }

    await this.channel.consume(q.queue, async (msg: any) => {
      if (!msg) return;
      try {
        const envelope: EventEnvelope = JSON.parse(msg.content.toString());
        await handler(envelope);
        this.channel.ack(msg);
      } catch (error) {
        this.channel.nack(msg, false, false);
      }
    });
  }

  async close(): Promise<void> {
    if (this.channel) await this.channel.close();
    if (this.connection) await this.connection.close();
  }
}
