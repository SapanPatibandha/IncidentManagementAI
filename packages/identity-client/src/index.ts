import axios, { AxiosInstance } from 'axios';

export interface RegisterClientRequest {
  clientId: string;
  clientSecret: string;
  scopes: string[];
  redirectUris: string[];
}

export interface ClientResponse {
  clientId: string;
  clientSecret: string;
  scopes: string[];
}

export class IdentityAdminClient {
  private client: AxiosInstance;

  constructor(baseURL: string, apiKey?: string) {
    this.client = axios.create({
      baseURL,
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey && { 'Authorization': `Bearer ${apiKey}` }),
      },
    });
  }

  async registerClient(request: RegisterClientRequest): Promise<ClientResponse> {
    const response = await this.client.post('/admin/clients', request);
    return response.data;
  }

  async getJWKS(): Promise<any> {
    const response = await this.client.get('/.well-known/jwks.json');
    return response.data;
  }

  async getPublicKey(): Promise<string> {
    const jwks = await this.getJWKS();
    // Assuming RSA key
    const key = jwks.keys.find((k: any) => k.kty === 'RSA');
    if (!key) throw new Error('RSA key not found in JWKS');
    return key.n; // modulus
  }
}