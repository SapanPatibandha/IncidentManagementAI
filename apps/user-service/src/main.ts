import Fastify from 'fastify';
import cors from '@fastify/cors';
import { env } from './config/env';
import { logger } from '@incident-management-ai/logger';
import { EventStore } from './infrastructure/event-store/EventStore';
import { MessageBus } from './infrastructure/message-bus/MessageBus';
import { ReadModelStore } from './infrastructure/read-models/ReadModelStore';
import { CommandBus } from './application/CommandBus';
import { UserProjector } from './application/projectors/UserProjector';
import { userRoutes } from './api/routes/users';

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
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT,
      role TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL,
      updated_at TIMESTAMP NOT NULL
    );
  `);
}

async function replayEvents(eventStore: EventStore, projector: UserProjector) {
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

  await messageBus.connect();
  await createTables(eventStore.pool);

  const projector = new UserProjector(readModelStore);
  await replayEvents(eventStore, projector);

  const commandBus = new CommandBus(eventStore, messageBus);

  const originalExecute = commandBus.execute.bind(commandBus);
  commandBus.execute = async (command) => {
    await originalExecute(command);
    const events = await eventStore.getEvents(command.aggregateId);
    const latestEvents = events.slice(-1);
    for (const event of latestEvents) {
      await projector.project(event);
    }
  };

  await userRoutes(app, commandBus, readModelStore);

  app.get('/health', async () => ({ status: 'ok' }));

  await app.listen({ port: env.PORT, host: '0.0.0.0' });
  logger.info(`User Service listening on port ${env.PORT}`);

  process.on('SIGINT', async () => {
    await eventStore.close();
    await messageBus.close();
    await readModelStore.close();
    process.exit(0);
  });
}

main().catch(logger.error);