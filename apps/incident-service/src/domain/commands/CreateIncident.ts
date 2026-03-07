import { DomainCommand } from './BaseCommand';

export class CreateIncident extends DomainCommand {
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