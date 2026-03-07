import { FastifyInstance } from 'fastify';
import { RegisterUser, UpdateUserProfile } from '../../domain/commands/UserCommands';
import { CommandBus } from '../../application/CommandBus';
import { ReadModelStore } from '../../infrastructure/read-models/ReadModelStore';

export async function userRoutes(app: FastifyInstance, commandBus: CommandBus, readModelStore: ReadModelStore) {
  // Register user (typically called by IdentityService or admin)
  app.post('/users', async (request, reply) => {
    const { email, role } = request.body as any;
    const userId = crypto.randomUUID();
    const command = new RegisterUser(userId, {
      email,
      role,
    });

    await commandBus.execute(command);
    reply.code(201).send({ id: userId });
  });

  // Get user by id
  app.get('/users/:id', async (request, reply) => {
    const { id } = request.params as any;
    const userId = request.headers['x-user-id'] as string;

    // Users can only see their own profile, admins can see all
    const userRole = request.headers['x-user-role'] as string;
    if (userRole !== 'Administrator' && userId !== id) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    const user = await readModelStore.getUser(id);
    if (!user) {
      return reply.code(404).send({ error: 'Not found' });
    }

    reply.send(user);
  });

  // Update user profile
  app.put('/users/:id', async (request, reply) => {
    const { id } = request.params as any;
    const { name, email } = request.body as any;
    const userId = request.headers['x-user-id'] as string;
    const userRole = request.headers['x-user-role'] as string;

    if (userRole !== 'Administrator' && userId !== id) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    const command = new UpdateUserProfile(id, {
      name,
      email,
    });

    await commandBus.execute(command);
    reply.send({ success: true });
  });

  // Get users by role (admin only)
  app.get('/users', async (request, reply) => {
    const { role } = request.query as any;
    const userRole = request.headers['x-user-role'] as string;

    if (userRole !== 'Administrator') {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    const users = await readModelStore.getUsersByRole(role);
    reply.send(users);
  });
}