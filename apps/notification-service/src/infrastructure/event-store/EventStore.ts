import { Pool } from 'pg';
import { env } from '../../config/env';
import { DomainEvent } from '../../domain/events/BaseEvent';

export class EventStore {
  public pool: Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: env.DATABASE_URL,
    });
  }

  async saveEvents(aggregateId: string, events: DomainEvent[]): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      for (const event of events) {
        await client.query(
          'INSERT INTO events (event_id, event_type, aggregate_id, aggregate_type, payload, metadata, version) VALUES ($1, $2, $3, $4, $5, $6, $7)',
          [
            event.eventId,
            event.eventType,
            event.aggregateId,
            event.aggregateType,
            JSON.stringify(event.payload),
            JSON.stringify(event.metadata),
            event.metadata.version,
          ]
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getEvents(aggregateId: string): Promise<DomainEvent[]> {
    const result = await this.pool.query(
      'SELECT * FROM events WHERE aggregate_id = $1 ORDER BY version',
      [aggregateId]
    );
    return result.rows.map((row) => ({
      eventId: row.event_id,
      eventType: row.event_type,
      aggregateId: row.aggregate_id,
      aggregateType: row.aggregate_type,
      payload: JSON.parse(row.payload),
      metadata: JSON.parse(row.metadata),
    }));
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
