import { FastifyRequest, FastifyReply } from 'fastify';

export async function enforceRole(request: FastifyRequest, reply: FastifyReply) {
  // Analytics endpoints are restricted to Administrators only.
  // Enforce this at the gateway so requests never reach downstream services.
  const path = request.raw.url ?? request.url ?? '';
  if (!path.startsWith('/analytics')) {
    return;
  }

  const roleHeader = request.headers['x-user-role'];
  const role = Array.isArray(roleHeader) ? roleHeader[0] : roleHeader;

  if (role !== 'Administrator') {
    return reply.code(403).send({ error: 'Forbidden' });
  }
}