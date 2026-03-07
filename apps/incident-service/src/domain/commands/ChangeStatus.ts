import { DomainCommand } from './BaseCommand';

export class ChangeStatus extends DomainCommand {
  constructor(
    aggregateId: string,
    payload: {
      toStatus: 'Open' | 'In-Process' | 'Closed';
      changedBy: string;
    }
  ) {
    super(aggregateId, payload);
  }
}