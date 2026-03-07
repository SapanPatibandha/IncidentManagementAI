import { DomainCommand } from './BaseCommand';

export class AddComment extends DomainCommand {
  constructor(
    aggregateId: string,
    payload: {
      content: string;
      authorId: string;
    }
  ) {
    super(aggregateId, payload);
  }
}