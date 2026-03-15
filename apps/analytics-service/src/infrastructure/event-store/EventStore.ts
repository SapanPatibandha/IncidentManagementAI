import { Pool } from 'pg';
import { env } from '../../config/env';
import { BaseEvent } from '../../domain/events/BaseEvent';

export class EventStore {
  public pool: Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: env.DATABASE_URL,
    });
  }

  async getEvents(aggregateId: string): Promise<BaseEvent[]> {
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
