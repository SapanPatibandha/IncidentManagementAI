import fp from 'fastify-plugin';
import proxy from '@fastify/http-proxy';
import { env } from '../config/env';

export const proxyPlugin = fp(async (fastify) => {
  // Proxy for auth routes
  fastify.register(proxy, {
    upstream: env.IDENTITY_SERVICE_URL,
    prefix: '/auth',
    rewritePrefix: '/api/v1/auth',
  });

  // Proxy for incidents
  fastify.register(proxy, {
    upstream: env.INCIDENT_SERVICE_URL,
    prefix: '/incidents',
    rewritePrefix: '',
  });

  // Proxy for users
  fastify.register(proxy, {
    upstream: env.USER_SERVICE_URL,
    prefix: '/users',
    rewritePrefix: '',
  });

  // Proxy for notifications
  fastify.register(proxy, {
    upstream: env.NOTIFICATION_SERVICE_URL,
    prefix: '/notifications',
    rewritePrefix: '',
  });

  // Proxy for analytics
  fastify.register(proxy, {
    upstream: env.ANALYTICS_SERVICE_URL,
    prefix: '/analytics',
    rewritePrefix: '',
  });
});