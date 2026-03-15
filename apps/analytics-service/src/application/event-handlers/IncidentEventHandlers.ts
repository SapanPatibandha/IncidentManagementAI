import { EventEnvelope } from '@incident-management-ai/event-contracts';
import { AnalyticsProjector } from '../projectors/AnalyticsProjector';

export class IncidentEventHandlers {
  constructor(private readonly projector: AnalyticsProjector) {}

  async handle(envelope: EventEnvelope): Promise<void> {
    await this.projector.project(envelope);
  }
}
