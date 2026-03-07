import { FastifyRequest, FastifyReply } from 'fastify';

export async function rateLimiter(request: FastifyRequest, reply: FastifyReply) {
  // Rate limiting is handled by @fastify/rate-limit plugin
}