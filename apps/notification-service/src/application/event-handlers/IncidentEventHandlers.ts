import { EventEnvelope } from '@incident-management-ai/event-contracts';
import { CommandBus } from '../CommandBus';
import { IncidentProjectionStore } from '../../infrastructure/read-models/IncidentProjectionStore';
import { CreateNotification } from '../../domain/commands/CreateNotification';

export class IncidentEventHandlers {
  constructor(
    private commandBus: CommandBus,
    private projectionStore: IncidentProjectionStore
  ) {}

  async handle(envelope: EventEnvelope): Promise<void> {
    switch (envelope.eventType) {
      case 'IncidentCreated':
        await this.handleIncidentCreated(envelope);
        break;
      case 'IncidentAssigned':
        await this.handleIncidentAssigned(envelope);
        break;
      case 'StatusChanged':
        await this.handleStatusChanged(envelope);
        break;
      case 'CommentAdded':
        await this.handleCommentAdded(envelope);
        break;
      default:
        // ignore other events
        break;
    }
  }

  private async handleIncidentCreated(envelope: EventEnvelope) {
    const { creatorId, title } = envelope.payload;
    await this.projectionStore.upsertIncident(envelope.aggregateId, creatorId);

    const command = new CreateNotification(crypto.randomUUID(), {
      recipientId: creatorId,
      title: 'Incident created',
      message: `Your incident "${title}" has been created.`,
      channel: 'in-app',
      metadata: { incidentId: envelope.aggregateId },
    });
    await this.commandBus.execute(command);
  }

  private async handleIncidentAssigned(envelope: EventEnvelope) {
    const { assigneeId, assignedBy } = envelope.payload;
    await this.projectionStore.setAssignee(envelope.aggregateId, assigneeId);

    const command = new CreateNotification(crypto.randomUUID(), {
      recipientId: assigneeId,
      title: 'You have been assigned an incident',
      message: `You were assigned to incident ${envelope.aggregateId} by ${assignedBy}.`,
      channel: 'both',
      metadata: { incidentId: envelope.aggregateId },
    });
    await this.commandBus.execute(command);
  }

  private async handleStatusChanged(envelope: EventEnvelope) {
    const { toStatus } = envelope.payload;
    const participants = await this.projectionStore.getParticipants(envelope.aggregateId);
    const recipientId = participants?.creatorId;
    if (!recipientId) return;

    const command = new CreateNotification(crypto.randomUUID(), {
      recipientId,
      title: 'Incident status updated',
      message: `Incident ${envelope.aggregateId} status changed to ${toStatus}.`,
      channel: 'both',
      metadata: { incidentId: envelope.aggregateId },
    });
    await this.commandBus.execute(command);
  }

  private async handleCommentAdded(envelope: EventEnvelope) {
    const { authorId } = envelope.payload;
    const participants = await this.projectionStore.getParticipants(envelope.aggregateId);
    if (!participants) return;

    const recipientId = participants.creatorId === authorId ? participants.assigneeId : participants.creatorId;
    if (!recipientId) return;

    const command = new CreateNotification(crypto.randomUUID(), {
      recipientId,
      title: 'New comment added',
      message: `A comment was added to incident ${envelope.aggregateId}.`,
      channel: 'in-app',
      metadata: { incidentId: envelope.aggregateId },
    });
    await this.commandBus.execute(command);
  }
}
