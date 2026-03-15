import Fastify from 'fastify';
import cors from '@fastify/cors';
import { env } from './config/env';
import { logger } from '@incident-management-ai/logger';
import { EventStore } from './infrastructure/event-store/EventStore';
import { MessageBus } from './infrastructure/message-bus/MessageBus';
import { ReadModelStore } from './infrastructure/read-models/ReadModelStore';
import { AnalyticsProjector } from './application/projectors/AnalyticsProjector';
import { IncidentEventHandlers } from './application/event-handlers/IncidentEventHandlers';
import { analyticsRoutes } from './api/routes/analytics';

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
    CREATE TABLE IF NOT EXISTS incident_metrics (
      incident_id UUID PRIMARY KEY,
      creator_id UUID NOT NULL,
      assignee_id UUID,
      status TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL,
      closed_at TIMESTAMP,
      escalation_count INTEGER NOT NULL,
      last_updated TIMESTAMP NOT NULL
    );
  `);
}

async function replayEvents(eventStore: EventStore, projector: AnalyticsProjector) {
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

  const projector = new AnalyticsProjector(readModelStore);
  const handlers = new IncidentEventHandlers(projector);

  await replayEvents(eventStore, projector);

  await messageBus.subscribe(['incident.incident.*'], async (envelope) => {
    await handlers.handle(envelope);
  });

  await analyticsRoutes(app, readModelStore);

  app.get('/health', async () => ({ status: 'ok' }));

  await app.listen({ port: env.PORT, host: '0.0.0.0' });
  logger.info(`Analytics Service listening on port ${env.PORT}`);

  process.on('SIGINT', async () => {
    await eventStore.close();
    await messageBus.close();
    await readModelStore.close();
    process.exit(0);
  });
}

main().catch(logger.error);
