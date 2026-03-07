export interface BaseCommand {
  commandId: string;
  commandType: string;
  aggregateId: string;
  payload: any;
}

export abstract class DomainCommand implements BaseCommand {
  public readonly commandId: string;
  public readonly commandType: string;
  public readonly aggregateId: string;
  public readonly payload: any;

  constructor(aggregateId: string, payload: any) {
    this.commandId = crypto.randomUUID();
    this.commandType = this.constructor.name;
    this.aggregateId = aggregateId;
    this.payload = payload;
  }
}