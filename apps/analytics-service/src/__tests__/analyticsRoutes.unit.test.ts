import Fastify from 'fastify';
import { describe, it, expect } from 'vitest';
import { analyticsRoutes } from '../api/routes/analytics';

describe('analyticsRoutes', () => {
  it('returns 403 when user is not an Administrator', async () => {
    const app = Fastify();
    const store = {
      getDashboardMetrics: async () => ({ openCount: 0, closedCount: 0, escalatedCount: 0, avgResolutionSeconds: 0 }),
      getResponderMetrics: async () => [],
      getAllIncidentMetrics: async () => [],
    } as any;

    await analyticsRoutes(app, store);

    const response = await app.inject({
      method: 'GET',
      url: '/analytics/dashboard',
      headers: { 'x-user-role': 'Incident Creator' },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: 'Forbidden' });

    await app.close();
  });

  it('returns dashboard metrics for Administrator', async () => {
    const app = Fastify();
    const store = {
      getDashboardMetrics: async () => ({ openCount: 1, closedCount: 2, escalatedCount: 3, avgResolutionSeconds: 4 }),
      getResponderMetrics: async () => [],
      getAllIncidentMetrics: async () => [],
    } as any;

    await analyticsRoutes(app, store);

    const response = await app.inject({
      method: 'GET',
      url: '/analytics/dashboard',
      headers: { 'x-user-role': 'Administrator' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ openCount: 1, closedCount: 2, escalatedCount: 3, avgResolutionSeconds: 4 });

    await app.close();
  });

  it('exports CSV when format=csv', async () => {
    const app = Fastify();
    const store = {
      getAllIncidentMetrics: async () => [
        {
          incidentId: 'inc-1',
          creatorId: 'creator-1',
          assigneeId: 'responder-1',
          status: 'Closed',
          createdAt: new Date('2024-01-01T00:00:00Z'),
          closedAt: new Date('2024-01-02T00:00:00Z'),
          escalationCount: 1,
          lastUpdated: new Date('2024-01-02T00:00:00Z'),
        },
      ],
      getDashboardMetrics: async () => ({ openCount: 0, closedCount: 0, escalatedCount: 0, avgResolutionSeconds: 0 }),
      getResponderMetrics: async () => [],
    } as any;

    await analyticsRoutes(app, store);

    const response = await app.inject({
      method: 'GET',
      url: '/analytics/export?format=csv',
      headers: { 'x-user-role': 'Administrator' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/csv');
    expect(response.body).toContain('incidentId,creatorId,assigneeId,status,createdAt,closedAt,escalationCount,lastUpdated');
    expect(response.body).toContain('inc-1,creator-1,responder-1,Closed,2024-01-01T00:00:00.000Z,2024-01-02T00:00:00.000Z,1,2024-01-02T00:00:00.000Z');

    await app.close();
  });
});
