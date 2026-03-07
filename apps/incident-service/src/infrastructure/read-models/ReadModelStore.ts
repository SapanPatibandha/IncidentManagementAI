import { Pool } from 'pg';
import { env } from '../../config/env';

export interface IncidentReadModel {
  id: string;
  title: string;
  description: string;
  status: 'Open' | 'In-Process' | 'Closed';
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  creatorId: string;
  assigneeId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class ReadModelStore {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: env.DATABASE_URL,
    });
  }

  async saveIncident(incident: IncidentReadModel): Promise<void> {
    await this.pool.query(
      `INSERT INTO incidents (id, title, description, status, priority, creator_id, assignee_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (id) DO UPDATE SET
         title = EXCLUDED.title,
         description = EXCLUDED.description,
         status = EXCLUDED.status,
         priority = EXCLUDED.priority,
         assignee_id = EXCLUDED.assignee_id,
         updated_at = EXCLUDED.updated_at`,
      [
        incident.id,
        incident.title,
        incident.description,
        incident.status,
        incident.priority,
        incident.creatorId,
        incident.assigneeId,
        incident.createdAt,
        incident.updatedAt,
      ]
    );
  }

  async getIncident(id: string): Promise<IncidentReadModel | null> {
    const result = await this.pool.query('SELECT * FROM incidents WHERE id = $1', [id]);
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      status: row.status,
      priority: row.priority,
      creatorId: row.creator_id,
      assigneeId: row.assignee_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async getIncidentsByCreator(creatorId: string): Promise<IncidentReadModel[]> {
    const result = await this.pool.query('SELECT * FROM incidents WHERE creator_id = $1 ORDER BY created_at DESC', [creatorId]);
    return result.rows.map(row => ({
      id: row.id,
      title: row.title,
      description: row.description,
      status: row.status,
      priority: row.priority,
      creatorId: row.creator_id,
      assigneeId: row.assignee_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  async getIncidentsByAssignee(assigneeId: string): Promise<IncidentReadModel[]> {
    const result = await this.pool.query('SELECT * FROM incidents WHERE assignee_id = $1 ORDER BY created_at DESC', [assigneeId]);
    return result.rows.map(row => ({
      id: row.id,
      title: row.title,
      description: row.description,
      status: row.status,
      priority: row.priority,
      creatorId: row.creator_id,
      assigneeId: row.assignee_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}