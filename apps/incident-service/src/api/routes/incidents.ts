import { FastifyInstance } from 'fastify';
import { CreateIncident } from '../../domain/commands/CreateIncident';
import { ChangeStatus } from '../../domain/commands/ChangeStatus';
import { AddComment } from '../../domain/commands/AddComment';
import { AssignIncident } from '../../domain/commands/AssignIncident';
import { CommandBus } from '../../application/CommandBus';
import { ReadModelStore } from '../../infrastructure/read-models/ReadModelStore';

export async function incidentRoutes(app: FastifyInstance, commandBus: CommandBus, readModelStore: ReadModelStore) {
  // Create incident
  app.post('/incidents', async (request, reply) => {
    const { title, description, priority } = request.body as any;
    const userId = request.headers['x-user-id'] as string;
    const userRole = request.headers['x-user-role'] as string;

    if (userRole !== 'Incident Creator') {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    const incidentId = crypto.randomUUID();
    const command = new CreateIncident(incidentId, {
      title,
      description,
      priority,
      creatorId: userId,
    });

    await commandBus.execute(command);
    reply.code(201).send({ id: incidentId });
  });

  // Get incidents for user
  app.get('/incidents', async (request, reply) => {
    const userId = request.headers['x-user-id'] as string;
    const userRole = request.headers['x-user-role'] as string;

    let incidents: any[] = [];
    if (userRole === 'Incident Creator') {
      incidents = await readModelStore.getIncidentsByCreator(userId);
    } else if (userRole === 'Issue Responder') {
      incidents = await readModelStore.getIncidentsByAssignee(userId);
    } else if (userRole === 'Administrator') {
      // For admin, get all, but for now, empty
      incidents = [];
    } else {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    reply.send(incidents);
  });

  // Get incident by id
  app.get('/incidents/:id', async (request, reply) => {
    const { id } = request.params as any;
    const userId = request.headers['x-user-id'] as string;
    const userRole = request.headers['x-user-role'] as string;

    const incident = await readModelStore.getIncident(id);
    if (!incident) {
      return reply.code(404).send({ error: 'Not found' });
    }

    // Check permissions
    if (userRole === 'Incident Creator' && incident.creatorId !== userId) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    if (userRole === 'Issue Responder' && incident.assigneeId !== userId) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    reply.send(incident);
  });

  // Change status
  app.put('/incidents/:id/status', async (request, reply) => {
    const { id } = request.params as any;
    const { status } = request.body as any;
    const userId = request.headers['x-user-id'] as string;
    const userRole = request.headers['x-user-role'] as string;

    const incident = await readModelStore.getIncident(id);
    if (!incident) {
      return reply.code(404).send({ error: 'Not found' });
    }

    // Business rules
    if (userRole === 'Incident Creator') {
      if (incident.creatorId !== userId) {
        return reply.code(403).send({ error: 'Forbidden' });
      }
      if (status === 'In-Process') {
        return reply.code(400).send({ error: 'Creators cannot move to In-Process' });
      }
    } else if (userRole === 'Issue Responder') {
      if (incident.assigneeId !== userId) {
        return reply.code(403).send({ error: 'Forbidden' });
      }
    }

    const command = new ChangeStatus(id, {
      toStatus: status,
      changedBy: userId,
    });

    await commandBus.execute(command);
    reply.send({ success: true });
  });

  // Add comment
  app.post('/incidents/:id/comments', async (request, reply) => {
    const { id } = request.params as any;
    const { content } = request.body as any;
    const userId = request.headers['x-user-id'] as string;
    const userRole = request.headers['x-user-role'] as string;

    const incident = await readModelStore.getIncident(id);
    if (!incident) {
      return reply.code(404).send({ error: 'Not found' });
    }

    // Check permissions
    if (userRole === 'Incident Creator' && incident.creatorId !== userId) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    if (userRole === 'Issue Responder' && incident.assigneeId !== userId) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    const command = new AddComment(id, {
      content,
      authorId: userId,
    });

    await commandBus.execute(command);
    reply.code(201).send({ success: true });
  });

  // Assign incident (admin only)
  app.put('/incidents/:id/assign', async (request, reply) => {
    const { id } = request.params as any;
    const { assigneeId } = request.body as any;
    const userId = request.headers['x-user-id'] as string;
    const userRole = request.headers['x-user-role'] as string;

    if (userRole !== 'Administrator') {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    const command = new AssignIncident(id, {
      assigneeId,
      assignedBy: userId,
    });

    await commandBus.execute(command);
    reply.send({ success: true });
  });
}