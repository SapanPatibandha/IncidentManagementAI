import Fastify from 'fastify';
import cors from '@fastify/cors';
import { env } from './config/env';
import { logger } from '@incident-management-ai/logger';
import { EventStore } from './infrastructure/event-store/EventStore';
import { MessageBus } from './infrastructure/message-bus/MessageBus';
import { ReadModelStore } from './infrastructure/read-models/ReadModelStore';
import { IncidentProjectionStore } from './infrastructure/read-models/IncidentProjectionStore';
import { Mailer } from './infrastructure/mailer/Mailer';
import { CommandBus } from './application/CommandBus';
import { NotificationProjector } from './application/projectors/NotificationProjector';
import { IncidentEventHandlers } from './application/event-handlers/IncidentEventHandlers';
import { notificationRoutes } from './api/routes/notifications';

async function createTables(pool: any) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS events (
      event_id UUID PRIMARY KEY,
      event_type TEXT NOT NULL,
      aggregate_id UUID NOT NULL,
      aggregate_type TEXT NOT NULL,
      payload JSONB NOT NULL,
      metadata JSONB NOT NULL,
      version INTEGER NOT NULL,
      UNIQUE(aggregate_id, version)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id UUID PRIMARY KEY,
      recipient_id UUID NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      channel TEXT NOT NULL,
      is_read BOOLEAN NOT NULL,
      created_at TIMESTAMP NOT NULL
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS incident_participants (
      incident_id UUID PRIMARY KEY,
      creator_id UUID NOT NULL,
      assignee_id UUID
    );
  `);
}

async function replayEvents(eventStore: EventStore, projector: NotificationProjector) {
  const allEvents = await eventStore.pool.query('SELECT * FROM events ORDER BY metadata->>\'occurredAt\'');
  for (const row of allEvents.rows) {
    const event = {
      eventId: row.event_id,
      eventType: row.event_type,
      aggregateId: row.aggregate_id,
      aggregateType: row.aggregate_type,
      payload: JSON.parse(row.payload),
      metadata: JSON.parse(row.metadata),
    };
    await projector.project(event);
  }
}

async function main() {
  const app = Fastify({ logger: false });
  await app.register(cors);

  const eventStore = new EventStore();
  const messageBus = new MessageBus();
  const readModelStore = new ReadModelStore();
  const incidentProjectionStore = new IncidentProjectionStore();
  const mailer = new Mailer();

  await messageBus.connect();
  await createTables(eventStore.pool);

  const commandBus = new CommandBus(eventStore, messageBus);
  const projector = new NotificationProjector(readModelStore, mailer);
  const handlers = new IncidentEventHandlers(commandBus, incidentProjectionStore);

  await replayEvents(eventStore, projector);

  await messageBus.subscribe(
    ['incident.incident.*'],
    async (envelope) => {
      await handlers.handle(envelope);
    }
  );

  // After processing, project notifications into read model
  const originalExecute = commandBus.execute.bind(commandBus);
  commandBus.execute = async (command) => {
    await originalExecute(command);
    const events = await eventStore.getEvents(command.aggregateId);
    const latestEvents = events.slice(-1);
    for (const event of latestEvents) {
      await projector.project(event);
    }
  };

  await notificationRoutes(app, readModelStore);

  app.get('/health', async () => ({ status: 'ok' }));

  await app.listen({ port: env.PORT, host: '0.0.0.0' });
  logger.info(`Notification Service listening on port ${env.PORT}`);

  process.on('SIGINT', async () => {
    await eventStore.close();
    await messageBus.close();
    await readModelStore.close();
    await incidentProjectionStore.close();
    process.exit(0);
  });
}

main().catch(logger.error);
