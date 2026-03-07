import { DomainCommand } from './BaseCommand';

export class AssignIncident extends DomainCommand {
  constructor(
    aggregateId: string,
    payload: {
      assigneeId: string;
      assignedBy: string;
    }
  ) {
    super(aggregateId, payload);
  }
}