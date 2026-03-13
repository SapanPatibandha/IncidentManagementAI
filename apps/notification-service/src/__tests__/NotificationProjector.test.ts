import { describe, it, expect, vi } from 'vitest';
import { NotificationProjector } from '../application/projectors/NotificationProjector';
import { ReadModelStore } from '../infrastructure/read-models/ReadModelStore';
import { Mailer } from '../infrastructure/mailer/Mailer';

const makeEvent = (channel: 'in-app' | 'email' | 'both') => ({
  eventId: crypto.randomUUID(),
  eventType: 'NotificationCreated',
  aggregateId: 'notif-1',
  aggregateType: 'Notification',
  payload: {
    recipientId: 'user@example.com',
    title: 'Test',
    message: 'Hello',
    channel,
  },
  metadata: {
    occurredAt: new Date(),
    version: 1,
  },
});

describe('NotificationProjector', () => {
  it('saves notification to read model for in-app channel only', async () => {
    const saveNotification = vi.fn();
    const sendEmail = vi.fn();
    const store = { saveNotification } as unknown as ReadModelStore;
    const mailer = { sendEmail } as unknown as Mailer;
    const projector = new NotificationProjector(store, mailer);

    await projector.project(makeEvent('in-app'));

    expect(saveNotification).toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('sends email when channel is both', async () => {
    const saveNotification = vi.fn();
    const sendEmail = vi.fn();
    const store = { saveNotification } as unknown as ReadModelStore;
    const mailer = { sendEmail, renderTemplate: () => 'html' } as unknown as Mailer;
    const projector = new NotificationProjector(store, mailer);

    await projector.project(makeEvent('both'));

    expect(saveNotification).toHaveBeenCalled();
    expect(sendEmail).toHaveBeenCalledWith('user@example.com', 'Test', 'html');
  });
});
