import { FastifyInstance } from 'fastify';
import { ReadModelStore } from '../../infrastructure/read-models/ReadModelStore';

export async function analyticsRoutes(app: FastifyInstance, readModelStore: ReadModelStore) {
  const requireAdmin = (request: any, reply: any) => {
    const role = request.headers['x-user-role'];
    if (role !== 'Administrator') {
      reply.code(403).send({ error: 'Forbidden' });
      return false;
    }
    return true;
  };

  app.get('/analytics/dashboard', async (request, reply) => {
    if (!requireAdmin(request, reply)) return;
    const metrics = await readModelStore.getDashboardMetrics();
    reply.send(metrics);
  });

  app.get('/analytics/responders', async (request, reply) => {
    if (!requireAdmin(request, reply)) return;
    const metrics = await readModelStore.getResponderMetrics();
    reply.send(metrics);
  });

  app.get('/analytics/export', async (request, reply) => {
    if (!requireAdmin(request, reply)) return;
    const format = (request.query as any).format || 'json';
    const rows = await readModelStore.getAllIncidentMetrics();

    if (format === 'csv') {
      const header = 'incidentId,creatorId,assigneeId,status,createdAt,closedAt,escalationCount,lastUpdated';
      const lines = rows.map((r) =>
        [
          r.incidentId,
          r.creatorId,
          r.assigneeId ?? '',
          r.status,
          r.createdAt.toISOString(),
          r.closedAt?.toISOString() ?? '',
          r.escalationCount,
          r.lastUpdated.toISOString(),
        ].join(',')
      );
      reply.header('Content-Type', 'text/csv');
      reply.send([header, ...lines].join('\n'));
      return;
    }

    reply.send(rows);
  });
}
