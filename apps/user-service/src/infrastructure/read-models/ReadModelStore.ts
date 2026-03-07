import { Pool } from 'pg';
import { env } from '../../config/env';

export interface UserReadModel {
  id: string;
  email: string;
  name?: string;
  role: 'Incident Creator' | 'Issue Responder' | 'Administrator';
  createdAt: Date;
  updatedAt: Date;
}

export class ReadModelStore {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: env.DATABASE_URL,
    });
  }

  async saveUser(user: UserReadModel): Promise<void> {
    await this.pool.query(
      `INSERT INTO users (id, email, name, role, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET
         email = EXCLUDED.email,
         name = EXCLUDED.name,
         role = EXCLUDED.role,
         updated_at = EXCLUDED.updated_at`,
      [
        user.id,
        user.email,
        user.name,
        user.role,
        user.createdAt,
        user.updatedAt,
      ]
    );
  }

  async getUser(id: string): Promise<UserReadModel | null> {
    const result = await this.pool.query('SELECT * FROM users WHERE id = $1', [id]);
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async getUsersByRole(role: string): Promise<UserReadModel[]> {
    const result = await this.pool.query('SELECT * FROM users WHERE role = $1 ORDER BY created_at DESC', [role]);
    return result.rows.map(row => ({
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}