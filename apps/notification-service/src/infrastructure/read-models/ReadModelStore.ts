import { Pool } from 'pg';
import { env } from '../../config/env';

export interface NotificationReadModel {
  id: string;
  recipientId: string;
  title: string;
  message: string;
  channel: 'in-app' | 'email' | 'both';
  isRead: boolean;
  createdAt: Date;
}

export class ReadModelStore {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: env.DATABASE_URL,
    });
  }

  async saveNotification(notification: NotificationReadModel): Promise<void> {
    await this.pool.query(
      `INSERT INTO notifications (id, recipient_id, title, message, channel, is_read, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO UPDATE SET
         title = EXCLUDED.title,
         message = EXCLUDED.message,
         channel = EXCLUDED.channel,
         is_read = EXCLUDED.is_read,
         created_at = EXCLUDED.created_at`,
      [
        notification.id,
        notification.recipientId,
        notification.title,
        notification.message,
        notification.channel,
        notification.isRead,
        notification.createdAt,
      ]
    );
  }

  async markRead(id: string): Promise<void> {
    await this.pool.query('UPDATE notifications SET is_read = TRUE WHERE id = $1', [id]);
  }

  async getNotificationById(id: string): Promise<NotificationReadModel | null> {
    const result = await this.pool.query('SELECT * FROM notifications WHERE id = $1', [id]);
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      id: row.id,
      recipientId: row.recipient_id,
      title: row.title,
      message: row.message,
      channel: row.channel,
      isRead: row.is_read,
      createdAt: row.created_at,
    };
  }

  async getNotifications(recipientId: string, onlyUnread = false): Promise<NotificationReadModel[]> {
    const query = onlyUnread
      ? 'SELECT * FROM notifications WHERE recipient_id = $1 AND is_read = FALSE ORDER BY created_at DESC'
      : 'SELECT * FROM notifications WHERE recipient_id = $1 ORDER BY created_at DESC';

    const result = await this.pool.query(query, [recipientId]);

    return result.rows.map((row) => ({
      id: row.id,
      recipientId: row.recipient_id,
      title: row.title,
      message: row.message,
      channel: row.channel,
      isRead: row.is_read,
      createdAt: row.created_at,
    }));
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
