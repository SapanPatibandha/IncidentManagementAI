import { env } from './env';

export const ROUTES = {
  '/auth/*': env.IDENTITY_SERVICE_URL.replace('/api/v1/auth', ''), // Assuming base URL
  '/incidents/*': env.INCIDENT_SERVICE_URL,
  '/users/*': env.USER_SERVICE_URL,
  '/notifications/*': env.NOTIFICATION_SERVICE_URL,
  '/analytics/*': env.ANALYTICS_SERVICE_URL,
} as const;