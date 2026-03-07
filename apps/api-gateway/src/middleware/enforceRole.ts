import { FastifyRequest, FastifyReply } from 'fastify';

export async function enforceRole(request: FastifyRequest, reply: FastifyReply) {
  // For now, allow all authenticated requests
  // In future, add route-specific role checks
}