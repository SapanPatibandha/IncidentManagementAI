import { DomainEvent } from './BaseEvent';

export class StatusChanged extends DomainEvent {
  constructor(
    aggregateId: string,
    payload: {
      fromStatus: 'Open' | 'In-Process' | 'Closed';
      toStatus: 'Open' | 'In-Process' | 'Closed';
      changedBy: string;
    },
    version: number
  ) {
    super(aggregateId, payload, version);
  }
}