export interface EventEnvelope {
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

export const EXCHANGES = {
  INCIDENT_EVENTS: 'incident.events',
  USER_EVENTS: 'user.events',
  NOTIFICATION_EVENTS: 'notification.events',
  ANALYTICS_EVENTS: 'analytics.events',
} as const;

export const ROUTING_KEYS = {
  INCIDENT_CREATED: 'incident.created',
  INCIDENT_UPDATED: 'incident.updated',
  USER_REGISTERED: 'user.registered',
  NOTIFICATION_SENT: 'notification.sent',
  ANALYTICS_UPDATED: 'analytics.updated',
} as const;