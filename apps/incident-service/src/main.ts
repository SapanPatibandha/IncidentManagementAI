import Fastify from 'fastify';
import cors from '@fastify/cors';
import { env } from './config/env';
import { logger } from '@incident-management-ai/logger';
import { EventStore } from './infrastructure/event-store/EventStore';
import { MessageBus } from './infrastructure/message-bus/MessageBus';
import { ReadModelStore } from './infrastructure/read-models/ReadModelStore';
import { CommandBus } from './application/CommandBus';
import { IncidentProjector } from './application/projectors/IncidentProjector';
import { incidentRoutes } from './api/routes/incidents';

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
    CREATE TABLE IF NOT EXISTS incidents (
      id UUID PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL,
      priority TEXT NOT NULL,
      creator_id UUID NOT NULL,
      assignee_id UUID,
      created_at TIMESTAMP NOT NULL,
      updated_at TIMESTAMP NOT NULL
    );
  `);
}

async function replayEvents(eventStore: EventStore, projector: IncidentProjector) {
  // For simplicity, get all events and replay
  // In production, use snapshots
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

  // Infrastructure
  const eventStore = new EventStore();
  const messageBus = new MessageBus();
  const readModelStore = new ReadModelStore();

  await messageBus.connect();
  await createTables(eventStore.pool);

  // Application
  const projector = new IncidentProjector(readModelStore);
  await replayEvents(eventStore, projector);

  const commandBus = new CommandBus(eventStore, messageBus);

  // After executing commands, project events
  // Monkey patch for simplicity
  const originalExecute = commandBus.execute.bind(commandBus);
  commandBus.execute = async (command) => {
    await originalExecute(command);
    // Get the latest events and project
    const events = await eventStore.getEvents(command.aggregateId);
    const latestEvents = events.slice(-1); // Assume one event per command
    for (const event of latestEvents) {
      await projector.project(event);
    }
  };

  // Routes
  await incidentRoutes(app, commandBus, readModelStore);

  app.get('/health', async () => ({ status: 'ok' }));

  await app.listen({ port: env.PORT, host: '0.0.0.0' });
  logger.info(`Incident Service listening on port ${env.PORT}`);

  // Graceful shutdown
  process.on('SIGINT', async () => {
    await eventStore.close();
    await messageBus.close();
    await readModelStore.close();
    process.exit(0);
  });
}

main().catch(logger.error);