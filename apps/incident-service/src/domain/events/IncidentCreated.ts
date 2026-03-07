import { DomainEvent } from './BaseEvent';

export class IncidentCreated extends DomainEvent {
  constructor(
    aggregateId: string,
    payload: {
      title: string;
      description: string;
      priority: 'Low' | 'Medium' | 'High' | 'Critical';
      creatorId: string;
    }
  ) {
    super(aggregateId, payload);
  }
}