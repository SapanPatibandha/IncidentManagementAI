import { FastifyRequest, FastifyReply } from 'fastify';
import { env } from '../config/env';

export interface JWTClaims {
  sub: string; // userId
  email: string;
  scope: string; // space-separated scopes
}

declare module 'fastify' {
  interface FastifyInstance {
    verifyJwt: (token: string) => Promise<JWTClaims>;
  }
}

export async function verifyJwt(request: FastifyRequest, reply: FastifyReply) {
  // Skip JWT verification for health check and auth routes
  if (request.url === '/health' || request.url.startsWith('/auth/')) {
    return;
  }

  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return reply.code(401).send({ error: 'Unauthorized', message: 'Missing or invalid token' });
  }

  const token = authHeader.substring(7);
  try {
    const claims = await request.server.verifyJwt(token);
    request.user = claims; // Attach to request
  } catch (error) {
    return reply.code(401).send({ error: 'Unauthorized', message: 'Invalid token' });
  }
}