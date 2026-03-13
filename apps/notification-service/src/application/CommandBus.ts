import { DomainCommand } from '../domain/commands/BaseCommand';
import { NotificationAggregate } from '../domain/aggregates/NotificationAggregate';
import { EventStore } from '../infrastructure/event-store/EventStore';
import { MessageBus } from '../infrastructure/message-bus/MessageBus';

export class CommandBus {
  constructor(
    private eventStore: EventStore,
    private messageBus: MessageBus
  ) {}

  async execute(command: DomainCommand): Promise<void> {
    const events = await this.eventStore.getEvents(command.aggregateId);
    const aggregate = NotificationAggregate.rehydrate(command.aggregateId, events);
    const newEvents = aggregate.handle(command);

    await this.eventStore.saveEvents(command.aggregateId, newEvents);

    for (const event of newEvents) {
      await this.messageBus.publish(event);
    }
  }
}
