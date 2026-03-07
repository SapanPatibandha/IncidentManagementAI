import { FastifyInstance } from 'fastify';

export async function registerRoutes(app: FastifyInstance) {
  // Health check - no JWT required
  app.get('/health', async () => ({ status: 'ok' }));

  // All other routes are handled by proxy plugin
}