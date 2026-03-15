import { Pool } from 'pg';
import { env } from '../../config/env';

export interface IncidentMetric {
  incidentId: string;
  creatorId: string;
  assigneeId?: string | null;
  status: string;
  createdAt: Date;
  closedAt?: Date | null;
  escalationCount: number;
  lastUpdated: Date;
}

export interface DashboardMetrics {
  openCount: number;
  closedCount: number;
  escalatedCount: number;
  avgResolutionSeconds: number | null;
}

export interface ResponderMetrics {
  responderId: string;
  openCount: number;
  closedCount: number;
  avgResolutionSeconds: number | null;
}

export class ReadModelStore {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: env.DATABASE_URL,
    });
  }

  async upsertIncidentMetric(metric: IncidentMetric): Promise<void> {
    await this.pool.query(
      `INSERT INTO incident_metrics (
         incident_id,
         creator_id,
         assignee_id,
         status,
         created_at,
         closed_at,
         escalation_count,
         last_updated
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (incident_id) DO UPDATE SET
         assignee_id = EXCLUDED.assignee_id,
         status = EXCLUDED.status,
         closed_at = EXCLUDED.closed_at,
         escalation_count = EXCLUDED.escalation_count,
         last_updated = EXCLUDED.last_updated`,
      [
        metric.incidentId,
        metric.creatorId,
        metric.assigneeId,
        metric.status,
        metric.createdAt,
        metric.closedAt,
        metric.escalationCount,
        metric.lastUpdated,
      ]
    );
  }

  async getDashboardMetrics(): Promise<DashboardMetrics> {
    const result = await this.pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status <> 'Closed') AS open_count,
        COUNT(*) FILTER (WHERE status = 'Closed') AS closed_count,
        SUM(escalation_count) AS escalated_count,
        AVG(EXTRACT(EPOCH FROM (closed_at - created_at))) FILTER (WHERE closed_at IS NOT NULL) AS avg_resolution_seconds
      FROM incident_metrics
    `);

    const row = result.rows[0];
    return {
      openCount: Number(row.open_count ?? 0),
      closedCount: Number(row.closed_count ?? 0),
      escalatedCount: Number(row.escalated_count ?? 0),
      avgResolutionSeconds: row.avg_resolution_seconds === null ? null : Number(row.avg_resolution_seconds),
    };
  }

  async getResponderMetrics(): Promise<ResponderMetrics[]> {
    const result = await this.pool.query(`
      SELECT
        assignee_id AS responder_id,
        COUNT(*) FILTER (WHERE status <> 'Closed') AS open_count,
        COUNT(*) FILTER (WHERE status = 'Closed') AS closed_count,
        AVG(EXTRACT(EPOCH FROM (closed_at - created_at))) FILTER (WHERE closed_at IS NOT NULL) AS avg_resolution_seconds
      FROM incident_metrics
      WHERE assignee_id IS NOT NULL
      GROUP BY assignee_id
    `);

    return result.rows.map((row) => ({
      responderId: row.responder_id,
      openCount: Number(row.open_count ?? 0),
      closedCount: Number(row.closed_count ?? 0),
      avgResolutionSeconds: row.avg_resolution_seconds === null ? null : Number(row.avg_resolution_seconds),
    }));
  }

  async getIncidentMetric(incidentId: string): Promise<IncidentMetric | null> {
    const result = await this.pool.query('SELECT * FROM incident_metrics WHERE incident_id = $1', [incidentId]);
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      incidentId: row.incident_id,
      creatorId: row.creator_id,
      assigneeId: row.assignee_id,
      status: row.status,
      createdAt: row.created_at,
      closedAt: row.closed_at,
      escalationCount: row.escalation_count,
      lastUpdated: row.last_updated,
    };
  }

  async getAllIncidentMetrics(): Promise<IncidentMetric[]> {
    const result = await this.pool.query('SELECT * FROM incident_metrics');
    return result.rows.map((row) => ({
      incidentId: row.incident_id,
      creatorId: row.creator_id,
      assigneeId: row.assignee_id,
      status: row.status,
      createdAt: row.created_at,
      closedAt: row.closed_at,
      escalationCount: row.escalation_count,
      lastUpdated: row.last_updated,
    }));
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
