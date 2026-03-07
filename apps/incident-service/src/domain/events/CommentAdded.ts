import { DomainEvent } from './BaseEvent';

export class CommentAdded extends DomainEvent {
  constructor(
    aggregateId: string,
    payload: {
      commentId: string;
      content: string;
      authorId: string;
    },
    version: number
  ) {
    super(aggregateId, payload, version);
  }
}