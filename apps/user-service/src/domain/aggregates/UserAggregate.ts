import { DomainEvent } from '../events/BaseEvent';
import { UserRegistered, UserProfileUpdated } from '../events/UserEvents';

export class UserAggregate {
  public id: string;
  public email: string = '';
  public name?: string;
  public role: 'Incident Creator' | 'Issue Responder' | 'Administrator' = 'Incident Creator';
  public createdAt: Date;
  public updatedAt: Date;
  private version: number = 0;

  constructor(id: string) {
    this.id = id;
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  static rehydrate(id: string, events: DomainEvent[]): UserAggregate {
    const aggregate = new UserAggregate(id);
    for (const event of events) {
      aggregate.apply(event);
    }
    return aggregate;
  }

  handle(command: any): DomainEvent[] {
    switch (command.commandType) {
      case 'RegisterUser':
        return this.handleRegisterUser(command);
      case 'UpdateUserProfile':
        return this.handleUpdateUserProfile(command);
      default:
        throw new Error(`Unknown command: ${command.commandType}`);
    }
  }

  private handleRegisterUser(command: any): DomainEvent[] {
    if (this.version > 0) {
      throw new Error('User already exists');
    }
    const event = new UserRegistered(this.id, command.payload);
    this.apply(event);
    return [event];
  }

  private handleUpdateUserProfile(command: any): DomainEvent[] {
    const event = new UserProfileUpdated(this.id, command.payload, this.version + 1);
    this.apply(event);
    return [event];
  }

  apply(event: DomainEvent): void {
    this.version = event.metadata.version;
    this.updatedAt = event.metadata.occurredAt;

    switch (event.eventType) {
      case 'UserRegistered':
        this.email = event.payload.email;
        this.role = event.payload.role;
        break;
      case 'UserProfileUpdated':
        if (event.payload.name) this.name = event.payload.name;
        if (event.payload.email) this.email = event.payload.email;
        break;
    }
  }
}