import { IdentityAdminClient } from '@incident-management-ai/identity-client';

async function registerClient() {
  const client = new IdentityAdminClient('http://localhost:8080');

  const request = {
    clientId: 'incident-management-web',
    clientSecret: 'super-secret-client-secret', // In production, generate securely
    scopes: [
      'api:incidents:read',
      'api:incidents:write',
      'api:incidents:manage',
      'api:incidents:admin',
      'api:users:read',
      'api:users:write',
      'api:notifications:read',
      'api:notifications:write',
      'api:analytics:read',
    ],
    redirectUris: ['http://localhost:3000/callback'], // For web app
  };

  try {
    const response = await client.registerClient(request);
    console.log('Client registered:', response);

    // Fetch and log JWKS
    const jwks = await client.getJWKS();
    console.log('JWKS:', jwks);

    const publicKey = await client.getPublicKey();
    console.log('RSA Public Key Modulus:', publicKey);
  } catch (error) {
    console.error('Error registering client:', error);
  }
}

registerClient();