export interface BaseEvent {
  eventId: string;
  eventType: string;
  aggregateId: string;
  aggregateType: string;
  payload: any;
  metadata: {
    occurredAt: Date;
    version: number;
  };
}

export abstract class DomainEvent implements BaseEvent {
  public readonly eventId: string;
  public readonly eventType: string;
  public readonly aggregateId: string;
  public readonly aggregateType: string;
  public readonly payload: any;
  public readonly metadata: {
    occurredAt: Date;
    version: number;
  };

  constructor(aggregateId: string, payload: any, version: number = 1) {
    this.eventId = crypto.randomUUID();
    this.eventType = this.constructor.name;
    this.aggregateId = aggregateId;
    this.aggregateType = 'Notification';
    this.payload = payload;
    this.metadata = {
      occurredAt: new Date(),
      version,
    };
  }
}
