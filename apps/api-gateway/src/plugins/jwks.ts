import { createRemoteJWKSet, jwtVerify } from 'jose';
import fp from 'fastify-plugin';
import { env } from '../config/env';
import { JWTClaims } from '../middleware/verifyJwt';

declare module 'fastify' {
  interface FastifyInstance {
    verifyJwt: (token: string) => Promise<JWTClaims>;
  }
}

export const jwksPlugin = fp(async (fastify) => {
  const JWKS_URL = new URL(env.IDENTITY_SERVICE_JWKS_URL);

  const JWKS = createRemoteJWKSet(JWKS_URL, {
    cooldownDuration: 300_000, // 5 min
    cacheMaxAge: 86_400_000, // 24h
  });

  fastify.decorate('verifyJwt', async (token: string): Promise<JWTClaims> => {
    const { payload } = await jwtVerify(token, JWKS, {
      algorithms: ['RS256'],
      issuer: env.IDENTITY_SERVICE_URL,
    });
    return payload as any as JWTClaims;
  });
});