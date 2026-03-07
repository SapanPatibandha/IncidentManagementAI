import { DomainEvent } from '../events/BaseEvent';
import { IncidentCreated } from '../events/IncidentCreated';
import { StatusChanged } from '../events/StatusChanged';
import { CommentAdded } from '../events/CommentAdded';
import { IncidentAssigned } from '../events/IncidentAssigned';

export class IncidentAggregate {
  public id: string;
  public title: string = '';
  public description: string = '';
  public status: 'Open' | 'In-Process' | 'Closed' = 'Open';
  public priority: 'Low' | 'Medium' | 'High' | 'Critical' = 'Low';
  public creatorId: string = '';
  public assigneeId?: string;
  public comments: Array<{ id: string; content: string; authorId: string; createdAt: Date }> = [];
  public createdAt: Date;
  public updatedAt: Date;
  private version: number = 0;

  constructor(id: string) {
    this.id = id;
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  static rehydrate(id: string, events: DomainEvent[]): IncidentAggregate {
    const aggregate = new IncidentAggregate(id);
    for (const event of events) {
      aggregate.apply(event);
    }
    return aggregate;
  }

  handle(command: any): DomainEvent[] {
    switch (command.commandType) {
      case 'CreateIncident':
        return this.handleCreateIncident(command);
      case 'ChangeStatus':
        return this.handleChangeStatus(command);
      case 'AddComment':
        return this.handleAddComment(command);
      case 'AssignIncident':
        return this.handleAssignIncident(command);
      default:
        throw new Error(`Unknown command: ${command.commandType}`);
    }
  }

  private handleCreateIncident(command: any): DomainEvent[] {
    if (this.version > 0) {
      throw new Error('Incident already exists');
    }
    const event = new IncidentCreated(
      this.id,
      command.payload
    );
    this.apply(event);
    return [event];
  }

  private handleChangeStatus(command: any): DomainEvent[] {
    if (this.status === command.payload.toStatus) {
      throw new Error('Status is already set to that value');
    }
    // Business rules from SRS
    if (this.status === 'Open' && command.payload.toStatus === 'In-Process') {
      // Only responders can move to In-Process
    }
    const event = new StatusChanged(
      this.id,
      {
        fromStatus: this.status,
        toStatus: command.payload.toStatus,
        changedBy: command.payload.changedBy,
      },
      this.version + 1
    );
    this.apply(event);
    return [event];
  }

  private handleAddComment(command: any): DomainEvent[] {
    const commentId = crypto.randomUUID();
    const event = new CommentAdded(
      this.id,
      {
        commentId,
        content: command.payload.content,
        authorId: command.payload.authorId,
      },
      this.version + 1
    );
    this.apply(event);
    return [event];
  }

  private handleAssignIncident(command: any): DomainEvent[] {
    const event = new IncidentAssigned(
      this.id,
      command.payload,
      this.version + 1
    );
    this.apply(event);
    return [event];
  }

  apply(event: DomainEvent): void {
    this.version = event.metadata.version;
    this.updatedAt = event.metadata.occurredAt;

    switch (event.eventType) {
      case 'IncidentCreated':
        this.title = event.payload.title;
        this.description = event.payload.description;
        this.priority = event.payload.priority;
        this.creatorId = event.payload.creatorId;
        break;
      case 'StatusChanged':
        this.status = event.payload.toStatus;
        break;
      case 'CommentAdded':
        this.comments.push({
          id: event.payload.commentId,
          content: event.payload.content,
          authorId: event.payload.authorId,
          createdAt: event.metadata.occurredAt,
        });
        break;
      case 'IncidentAssigned':
        this.assigneeId = event.payload.assigneeId;
        break;
    }
  }
}