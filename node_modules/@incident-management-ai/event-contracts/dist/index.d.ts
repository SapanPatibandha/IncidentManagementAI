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
export declare const EXCHANGES: {
    readonly INCIDENT_EVENTS: "incident.events";
    readonly USER_EVENTS: "user.events";
    readonly NOTIFICATION_EVENTS: "notification.events";
    readonly ANALYTICS_EVENTS: "analytics.events";
};
export declare const ROUTING_KEYS: {
    readonly INCIDENT_CREATED: "incident.created";
    readonly INCIDENT_UPDATED: "incident.updated";
    readonly USER_REGISTERED: "user.registered";
    readonly NOTIFICATION_SENT: "notification.sent";
    readonly ANALYTICS_UPDATED: "analytics.updated";
};
//# sourceMappingURL=index.d.ts.map