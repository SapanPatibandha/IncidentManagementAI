import { Pool } from 'pg';
import { env } from '../../config/env';

export interface IncidentParticipants {
  incidentId: string;
  creatorId: string;
  assigneeId?: string;
}

export class IncidentProjectionStore {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: env.DATABASE_URL,
    });
  }

  async upsertIncident(incidentId: string, creatorId: string, assigneeId?: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO incident_participants (incident_id, creator_id, assignee_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (incident_id) DO UPDATE SET assignee_id = EXCLUDED.assignee_id`,
      [incidentId, creatorId, assigneeId || null]
    );
  }

  async setAssignee(incidentId: string, assigneeId: string): Promise<void> {
    await this.pool.query(
      `UPDATE incident_participants SET assignee_id = $1 WHERE incident_id = $2`,
      [assigneeId, incidentId]
    );
  }

  async getParticipants(incidentId: string): Promise<IncidentParticipants | null> {
    const result = await this.pool.query('SELECT * FROM incident_participants WHERE incident_id = $1', [incidentId]);
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      incidentId: row.incident_id,
      creatorId: row.creator_id,
      assigneeId: row.assignee_id || undefined,
    };
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
