import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { env } from './config/env';
import { logger } from '@incident-management-ai/logger';
import { jwksPlugin } from './plugins/jwks';
import { proxyPlugin } from './plugins/proxy';
import { registerRoutes } from './routes';
import { errorHandler } from './errors/errorHandler';
import { verifyJwt } from './middleware/verifyJwt';
import { injectUserContext } from './middleware/injectUserContext';

async function main() {
  const app = Fastify({
    logger: false, // Use our logger
  });

  // Register plugins
  await app.register(cors);
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    keyGenerator: (req) => req.headers['x-user-id'] as string || req.ip,
  });

  await app.register(jwksPlugin);

  // Register routes
  registerRoutes(app);

  await app.register(proxyPlugin);

  // Global hooks (after routes to allow health bypass)
  app.addHook('preHandler', verifyJwt);
  app.addHook('preHandler', injectUserContext);

  // Error handler
  app.setErrorHandler(errorHandler);

  await app.listen({ port: env.PORT, host: '0.0.0.0' });
  logger.info(`API Gateway listening on port ${env.PORT}`);
}

main().catch(logger.error);