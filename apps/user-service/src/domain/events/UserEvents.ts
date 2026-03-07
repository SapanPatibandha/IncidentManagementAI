import { DomainEvent } from './BaseEvent';

export class UserRegistered extends DomainEvent {
  constructor(
    aggregateId: string,
    payload: {
      email: string;
      role: 'Incident Creator' | 'Issue Responder' | 'Administrator';
    }
  ) {
    super(aggregateId, payload);
  }
}

export class UserProfileUpdated extends DomainEvent {
  constructor(
    aggregateId: string,
    payload: {
      name?: string;
      email?: string;
    },
    version: number
  ) {
    super(aggregateId, payload, version);
  }
}