---
name: api-gateway-patterns
description: >
  Detailed implementation patterns for the Incident Management AI API Gateway.
  ALWAYS use this skill when building or modifying the api-gateway service — including
  JWT verification, JWKS rotation, role/scope mapping, request proxying, rate limiting,
  error handling, or any gateway middleware. Trigger on any mention of: api-gateway,
  gateway, JWT verify, JWKS, public key, token validation, route proxy, forwarding,
  rate limit, gateway middleware, scope mapping, role injection, or upstream service.
  Use alongside incident-management-architecture for route definitions.
---

# Incident Management AI — API Gateway Patterns Skill

This is the **authoritative implementation reference** for the `api-gateway` service.
Read this before writing any gateway code.

> **Always read alongside:**
> - `incident-management-architecture` — route prefixes, service ports, JWT payload structure
> - `incident-management-srs` — role rules enforced at gateway level

---

## Gateway Responsibilities (strict — do not add business logic here)

| Responsibility           | Yes/No |
|--------------------------|--------|
| Verify JWT signature     | ✅ Yes |
| Extract + inject user context headers | ✅ Yes |
| Enforce coarse-grained role rules per route | ✅ Yes |
| Rate limiting per user   | ✅ Yes |
| Request/response logging | ✅ Yes |
| Forward request to upstream | ✅ Yes |
| Health check endpoint    | ✅ Yes |
| Business logic           | ❌ Never |
| Data transformation      | ❌ Never |
| Direct DB access         | ❌ Never |

---

## Project Structure

```
apps/api-gateway/src/
├── config/
│   ├── env.ts              # Zod-validated env vars
│   └── routes.ts           # Upstream URL map per route prefix
├── middleware/
│   ├── verifyJwt.ts        # JWT verification using JWKS
│   ├── injectUserContext.ts # Extract claims → inject headers
│   ├── enforceRole.ts      # Route-level role guard
│   └── rateLimiter.ts      # Per-user rate limiting
├── plugins/
│   ├── jwks.ts             # JWKS fetcher + cache + auto-refresh
│   └── proxy.ts            # HTTP proxy plugin (undici)
├── routes/
│   └── index.ts            # All route registrations
├── errors/
│   └── errorHandler.ts     # Global error → standard response shape
└── main.ts                 # Bootstrap
```

---

## JWKS Fetcher + Cache

```typescript
// plugins/jwks.ts
import { createRemoteJWKSet, jwtVerify } from 'jose';
import fp from 'fastify-plugin';

declare module 'fastify' {
  interface FastifyInstance {
    verifyJwt: (token: string) => Promise<JWTClaims>;
  }
}

export const jwksPlugin = fp(async (fastify) => {
  const JWKS_URL = new URL(fastify.config.IDENTITY_SERVICE_JWKS_URL);

  // jose handles JWKS caching and auto-refresh internally
  // cooldownDuration: wait 5 min before re-fetching after a cache miss
  const JWKS = createRemoteJWKSet(JWKS_URL, {
    cooldownDuration: 300_000,
    cacheMaxAge: 86_400_000,  // 24h cache
  });

  fastify.decorate('verifyJwt', async (token: string): Promise<JWTClaims> => {
    const { payload } = await jwtVerify(token, JWKS, {
      algorithms: ['RS256'],
      issuer: fastify.config.IDENTITY_SERVICE_URL,
    });
    return payload as JWTClaims;
  });
});

export interface JWTClaims {
  sub: string;           // userId
  email: string;
  scope: string;         // space-separated scopes
  client_id: string;
  iat: number;
  exp: number;
}
```

---

## JWT Verification Middleware

```typescript
// middleware/verifyJwt.ts
import { FastifyRequest, FastifyReply } from 'fastify';

// Routes that bypass JWT verification
const PUBLIC_PATHS = new Set([
  '/health',
  '/auth/token',
  '/auth/refresh',
  '/auth/revoke',
]);

export async function verifyJwtMiddleware(request: FastifyRequest, reply: FastifyReply) {
  if (PUBLIC_PATHS.has(request.routerPath)) return; // skip public routes

  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return reply.status(401).send({ error: 'Unauthorized', message: 'Missing Bearer token' });
  }

  const token = authHeader.slice(7);
  try {
    const claims = await request.server.verifyJwt(token);
    request.jwtClaims = claims;  // attach to request for downstream middleware
  } catch (err: any) {
    const isExpired = err.code === 'ERR_JWT_EXPIRED';
    return reply.status(401).send({
      error: 'Unauthorized',
      message: isExpired ? 'Token expired' : 'Invalid token',
    });
  }
}
```

---

## User Context Injection

```typescript
// middleware/injectUserContext.ts
import { FastifyRequest, FastifyReply } from 'fastify';
import { UserRole } from '@incident-mgmt/shared-types';

// Extend Fastify request type
declare module 'fastify' {
  interface FastifyRequest {
    jwtClaims?: JWTClaims;
    userContext?: UserContext;
  }
}

export interface UserContext {
  userId: string;
  email: string;
  role: UserRole;
  scopes: string[];
}

// Scope → Role mapping (single source of truth)
const SCOPE_TO_ROLE: Array<[string, UserRole]> = [
  ['api:incidents:admin', 'Administrator'],
  ['api:incidents:manage', 'IssueResponder'],
  ['api:incidents:write', 'IncidentCreator'],
];

function deriveRole(scopes: string[]): UserRole {
  for (const [scope, role] of SCOPE_TO_ROLE) {
    if (scopes.includes(scope)) return role;
  }
  throw new Error('No recognized role scope found in token');
}

export async function injectUserContextMiddleware(request: FastifyRequest, reply: FastifyReply) {
  if (!request.jwtClaims) return; // skip public routes (no claims = public)

  const scopes = request.jwtClaims.scope.split(' ').filter(Boolean);

  let role: UserRole;
  try {
    role = deriveRole(scopes);
  } catch {
    return reply.status(403).send({ error: 'Forbidden', message: 'No valid role scope in token' });
  }

  request.userContext = { userId: request.jwtClaims.sub, email: request.jwtClaims.email, role, scopes };

  // Inject as headers for upstream services
  request.headers['x-user-id']    = request.jwtClaims.sub;
  request.headers['x-user-role']  = role;
  request.headers['x-user-email'] = request.jwtClaims.email;
  // Remove Authorization header before forwarding — upstreams don't need the raw JWT
  // (optional — keep if services need to verify themselves)
}
```

---

## Role Enforcement Per Route

```typescript
// middleware/enforceRole.ts
import { FastifyRequest, FastifyReply, HookHandlerDoneFunction } from 'fastify';
import { UserRole } from '@incident-mgmt/shared-types';

// Factory — creates a Fastify hook that enforces a minimum role
export function requireRole(...allowedRoles: UserRole[]) {
  return (request: FastifyRequest, reply: FastifyReply, done: HookHandlerDoneFunction) => {
    if (!request.userContext) {
      reply.status(401).send({ error: 'Unauthorized' });
      return done();
    }
    if (!allowedRoles.includes(request.userContext.role)) {
      reply.status(403).send({
        error: 'Forbidden',
        message: `This action requires one of: ${allowedRoles.join(', ')}`,
      });
      return done();
    }
    done();
  };
}

// Usage in route registration:
// fastify.post('/incidents/:id/assign', { onRequest: requireRole('Administrator') }, proxyHandler);
```

---

## Route Definitions + Proxy

```typescript
// routes/index.ts
import { FastifyInstance } from 'fastify';
import { requireRole } from '../middleware/enforceRole';
import { proxyTo } from '../plugins/proxy';

export async function registerRoutes(fastify: FastifyInstance) {
  const { config } = fastify;

  // ── Public auth routes (no JWT required) ──────────────────────────
  fastify.all('/auth/*', proxyTo(config.IDENTITY_SERVICE_URL, '/api/v1'));

  // ── Incident routes ───────────────────────────────────────────────
  fastify.post('/incidents',
    { onRequest: requireRole('IncidentCreator') },
    proxyTo(config.INCIDENT_SERVICE_URL));

  fastify.get('/incidents',
    { onRequest: requireRole('IncidentCreator', 'IssueResponder', 'Administrator') },
    proxyTo(config.INCIDENT_SERVICE_URL));

  fastify.get('/incidents/:id',
    { onRequest: requireRole('IncidentCreator', 'IssueResponder', 'Administrator') },
    proxyTo(config.INCIDENT_SERVICE_URL));

  fastify.patch('/incidents/:id/status',
    { onRequest: requireRole('IncidentCreator', 'IssueResponder') },
    proxyTo(config.INCIDENT_SERVICE_URL));

  fastify.post('/incidents/:id/assign',
    { onRequest: requireRole('Administrator') },
    proxyTo(config.INCIDENT_SERVICE_URL));

  fastify.post('/incidents/:id/comments',
    { onRequest: requireRole('IncidentCreator', 'IssueResponder') },
    proxyTo(config.INCIDENT_SERVICE_URL));

  fastify.post('/incidents/:id/reopen',
    { onRequest: requireRole('IncidentCreator', 'IssueResponder') },
    proxyTo(config.INCIDENT_SERVICE_URL));

  // ── User routes ───────────────────────────────────────────────────
  fastify.get('/users/me',
    { onRequest: requireRole('IncidentCreator', 'IssueResponder', 'Administrator') },
    proxyTo(config.USER_SERVICE_URL));

  fastify.patch('/users/me',
    { onRequest: requireRole('IncidentCreator', 'IssueResponder') },
    proxyTo(config.USER_SERVICE_URL));

  fastify.get('/users/responders',
    { onRequest: requireRole('Administrator') },
    proxyTo(config.USER_SERVICE_URL));

  fastify.patch('/users/:id/availability',
    { onRequest: requireRole('IssueResponder') },
    proxyTo(config.USER_SERVICE_URL));

  fastify.patch('/users/:id/role',
    { onRequest: requireRole('Administrator') },
    proxyTo(config.USER_SERVICE_URL));

  // ── Notification routes ───────────────────────────────────────────
  fastify.get('/notifications',
    { onRequest: requireRole('IncidentCreator', 'IssueResponder', 'Administrator') },
    proxyTo(config.NOTIFICATION_SERVICE_URL));

  fastify.patch('/notifications/:id/read',
    { onRequest: requireRole('IncidentCreator', 'IssueResponder', 'Administrator') },
    proxyTo(config.NOTIFICATION_SERVICE_URL));

  // ── Analytics routes (Admin only) ─────────────────────────────────
  fastify.get('/analytics/*',
    { onRequest: requireRole('Administrator') },
    proxyTo(config.ANALYTICS_SERVICE_URL));

  // ── Health ────────────────────────────────────────────────────────
  fastify.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));
}
```

---

## HTTP Proxy Plugin (undici)

```typescript
// plugins/proxy.ts
import { request as undiciRequest } from 'undici';
import { FastifyRequest, FastifyReply } from 'fastify';

// Factory — returns a Fastify route handler that proxies to upstream
export function proxyTo(upstreamBaseUrl: string, pathPrefix = '') {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const upstreamUrl = `${upstreamBaseUrl}${pathPrefix}${req.url}`;

    try {
      const upstreamRes = await undiciRequest(upstreamUrl, {
        method: req.method as any,
        headers: {
          ...req.headers,
          host: new URL(upstreamBaseUrl).host,  // override host header
        },
        body: req.method !== 'GET' && req.method !== 'HEAD'
          ? JSON.stringify(req.body)
          : undefined,
      });

      reply.status(upstreamRes.statusCode);

      // Forward relevant response headers
      const contentType = upstreamRes.headers['content-type'];
      if (contentType) reply.header('content-type', contentType);

      const responseBody = await upstreamRes.body.json().catch(() => null);
      reply.send(responseBody);
    } catch (err) {
      req.log.error({ err, upstreamUrl }, 'Proxy request failed');
      reply.status(502).send({ error: 'Bad Gateway', message: 'Upstream service unavailable' });
    }
  };
}
```

---

## Rate Limiting

```typescript
// Register in main.ts using @fastify/rate-limit
import rateLimit from '@fastify/rate-limit';

await fastify.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute',
  // Key by user ID if authenticated, fall back to IP
  keyGenerator: (request) =>
    request.userContext?.userId ?? request.ip,
  errorResponseBuilder: () => ({
    error: 'Too Many Requests',
    message: 'Rate limit exceeded. Try again in 1 minute.',
  }),
  // Skip rate limiting for health checks
  skip: (request) => request.routerPath === '/health',
});
```

---

## Standardised Error Response Shape

All errors — from gateway itself or forwarded from upstreams — use this shape:

```typescript
// errors/errorHandler.ts
interface ErrorResponse {
  error: string;      // short error code e.g. 'Unauthorized', 'Forbidden', 'Bad Gateway'
  message: string;    // human-readable detail
  statusCode: number;
  requestId: string;  // from Fastify's request.id for tracing
}

export function registerErrorHandler(fastify: FastifyInstance) {
  fastify.setErrorHandler((error, request, reply) => {
    const statusCode = error.statusCode ?? 500;
    request.log.error({ err: error, requestId: request.id }, 'Request error');
    reply.status(statusCode).send({
      error: error.name || 'InternalServerError',
      message: statusCode === 500 ? 'An unexpected error occurred' : error.message,
      statusCode,
      requestId: request.id,
    });
  });
}
```

---

## Environment Variables

```env
# apps/api-gateway/.env.example
PORT=3000
NODE_ENV=development
LOG_LEVEL=info

# IdentityService
IDENTITY_SERVICE_URL=http://identity-service:8080
IDENTITY_SERVICE_JWKS_URL=http://identity-service:8080/.well-known/jwks.json

# Upstream services
INCIDENT_SERVICE_URL=http://incident-service:3002
USER_SERVICE_URL=http://user-service:3003
NOTIFICATION_SERVICE_URL=http://notification-service:3004
ANALYTICS_SERVICE_URL=http://analytics-service:3005
```

---

## Gateway Unit Tests

```typescript
// middleware/injectUserContext.unit.test.ts
import { describe, it, expect } from 'vitest';
import { deriveRole } from './injectUserContext';

describe('deriveRole', () => {
  it('returns Administrator for api:incidents:admin scope', () => {
    expect(deriveRole(['api:incidents:admin', 'api:notifications:read'])).toBe('Administrator');
  });
  it('returns IssueResponder for api:incidents:manage scope', () => {
    expect(deriveRole(['api:incidents:manage', 'api:notifications:read'])).toBe('IssueResponder');
  });
  it('returns IncidentCreator for api:incidents:write scope', () => {
    expect(deriveRole(['api:incidents:write', 'api:notifications:read'])).toBe('IncidentCreator');
  });
  it('prioritises Administrator over lower roles', () => {
    // Should not happen in practice but test precedence
    expect(deriveRole(['api:incidents:write', 'api:incidents:admin'])).toBe('Administrator');
  });
  it('throws when no recognised scope present', () => {
    expect(() => deriveRole(['api:other:read'])).toThrow();
  });
});
```

---

## Startup Checklist

On `fastify.listen()`, the gateway must:
1. Fetch JWKS from IdentityService — **fail fast** if unreachable on first load
2. Confirm all upstream services are reachable via health checks
3. Log service URLs and rate limit config at INFO level
4. Register global error handler before any routes
