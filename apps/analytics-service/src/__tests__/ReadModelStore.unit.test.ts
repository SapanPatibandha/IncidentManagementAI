import { describe, it, expect, vi } from 'vitest';

// Tests run with NODE_ENV=test; allow our env schema to validate that.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgres://localhost:5432/analytics_test';
process.env.RABBITMQ_URL = 'amqp://localhost';

// Mock 'pg' Pool so we can assert queries without a real database.
vi.mock('pg', () => {
  return {
    Pool: vi.fn().mockImplementation(() => ({
      query: vi.fn(),
      end: vi.fn(),
    })),
  };
});

const { ReadModelStore } = await import('../infrastructure/read-models/ReadModelStore');
const { Pool } = await import('pg');

describe('ReadModelStore', () => {
  it('upserts incident metrics with correct SQL', async () => {
    // Grab the Pool instance created by ReadModelStore
    const store = new ReadModelStore();
    const poolInstances = (Pool as unknown as any).mock.results.map((r: any) => r.value);
    const poolInstance = poolInstances[poolInstances.length - 1];
    const querySpy = poolInstance.query as unknown as vi.Mock;

    await store.upsertIncidentMetric({
      incidentId: 'inc-1',
      creatorId: 'creator-1',
      assigneeId: 'responder-1',
      status: 'Open',
      createdAt: new Date('2024-01-01T00:00:00Z'),
      closedAt: null,
      escalationCount: 0,
      lastUpdated: new Date('2024-01-01T00:00:00Z'),
    });

    expect(querySpy).toHaveBeenCalled();
    const [sql, params] = querySpy.mock.calls[0];
    expect(sql).toContain('INSERT INTO incident_metrics');
    expect(params[0]).toBe('inc-1');
    expect(params[1]).toBe('creator-1');
    expect(params[2]).toBe('responder-1');
  });

  it('returns dashboard metrics from the query result', async () => {
    const store = new ReadModelStore();
    const poolInstances = (Pool as unknown as any).mock.results.map((r: any) => r.value);
    const poolInstance = poolInstances[poolInstances.length - 1];
    const querySpy = poolInstance.query as unknown as vi.Mock;

    querySpy.mockResolvedValueOnce({
      rows: [
        {
          open_count: 5,
          closed_count: 3,
          escalated_count: 2,
          avg_resolution_seconds: 123.4,
        },
      ],
    });

    const result = await store.getDashboardMetrics();

    expect(result).toEqual({
      openCount: 5,
      closedCount: 3,
      escalatedCount: 2,
      avgResolutionSeconds: 123.4,
    });
  });
});
