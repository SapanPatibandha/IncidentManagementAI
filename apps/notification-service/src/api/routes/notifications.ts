import { FastifyInstance } from 'fastify';
import { ReadModelStore } from '../../infrastructure/read-models/ReadModelStore';

export async function notificationRoutes(app: FastifyInstance, readModelStore: ReadModelStore) {
  app.get('/notifications', async (request, reply) => {
    const userId = request.headers['x-user-id'] as string;
    const query = request.query as any;
    const onlyUnread = query?.unread === 'true';

    const notifications = await readModelStore.getNotifications(userId, onlyUnread);
    const unreadCount = (await readModelStore.getNotifications(userId, true)).length;

    reply.send({ notifications, unreadCount });
  });

  app.patch('/notifications/:id/read', async (request, reply) => {
    const userId = request.headers['x-user-id'] as string;
    const { id } = request.params as any;

    const notification = await readModelStore.getNotificationById(id);
    if (!notification) {
      return reply.code(404).send({ error: 'Not found' });
    }

    if (notification.recipientId !== userId) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    await readModelStore.markRead(id);
    reply.send({ success: true });
  });
}

