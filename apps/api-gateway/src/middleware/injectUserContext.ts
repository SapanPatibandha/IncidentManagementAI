import { FastifyRequest, FastifyReply } from 'fastify';
import { JWTClaims } from './verifyJwt';

export async function injectUserContext(request: FastifyRequest, reply: FastifyReply) {
  const claims = request.user as JWTClaims;
  if (claims) {
    const scopes = claims.scope.split(' ');
    let role = 'Incident Creator'; // default

    if (scopes.includes('api:incidents:admin')) {
      role = 'Administrator';
    } else if (scopes.includes('api:incidents:manage')) {
      role = 'Issue Responder';
    }

    request.headers['x-user-id'] = claims.sub;
    request.headers['x-user-role'] = role;
    request.headers['x-user-email'] = claims.email;
  }
}