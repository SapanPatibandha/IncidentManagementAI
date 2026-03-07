import { DomainEvent } from './BaseEvent';

export class IncidentAssigned extends DomainEvent {
  constructor(
    aggregateId: string,
    payload: {
      assigneeId: string;
      assignedBy: string;
    },
    version: number
  ) {
    super(aggregateId, payload, version);
  }
}