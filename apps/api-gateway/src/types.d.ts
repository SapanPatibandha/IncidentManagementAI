import { FastifyRequest, FastifyReply } from 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    user?: import('./middleware/verifyJwt').JWTClaims;
  }
}