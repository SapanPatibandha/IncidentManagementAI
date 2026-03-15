import { createBrowserRouter } from 'react-router-dom';
import { requireAuth } from '../shared/lib/auth';
import { RoleGuard } from '../shared/components/RoleGuard';
import { RoleBasedRedirect } from '../shared/components/RoleBasedRedirect';

// Auth pages
import { LoginRedirectPage } from '../features/auth/pages/LoginRedirectPage';
import { OAuthCallbackPage } from '../features/auth/pages/OAuthCallbackPage';

// Incident Creator pages
import { IncidentListPage } from '../features/incidents/pages/IncidentListPage';
import { CreateIncidentPage } from '../features/incidents/pages/CreateIncidentPage';
import { IncidentDetailPage } from '../features/incidents/pages/IncidentDetailPage';

// Issue Responder pages
import { ResponderQueuePage } from '../features/responder/pages/ResponderQueuePage';

// Administrator pages
import { AdminDashboardPage } from '../features/admin/pages/AdminDashboardPage';
import { AdminIncidentsPage } from '../features/admin/pages/AdminIncidentsPage';
import { AdminUsersPage } from '../features/admin/pages/AdminUsersPage';

// Layout
import { AppLayout } from '../shared/components/AppLayout';

export const router = createBrowserRouter([
  // Public routes (no auth required)
  {
    path: '/auth/callback',
    element: <OAuthCallbackPage />,
  },
  {
    path: '/login',
    element: <LoginRedirectPage />,
  },

  // Protected routes (require valid JWT)
  {
    path: '/',
    element: <AppLayout />,
    loader: requireAuth,
    children: [
      // Incident Creator routes
      {
        path: 'dashboard',
        element: (
          <RoleGuard role="Incident Creator">
            <IncidentListPage />
          </RoleGuard>
        ),
      },
      {
        path: 'incidents/new',
        element: (
          <RoleGuard role="Incident Creator">
            <CreateIncidentPage />
          </RoleGuard>
        ),
      },
      {
        path: 'incidents/:id',
        element: <IncidentDetailPage />, // Shared — role-aware inside
      },

      // Issue Responder routes
      {
        path: 'queue',
        element: (
          <RoleGuard role="Issue Responder">
            <ResponderQueuePage />
          </RoleGuard>
        ),
      },

      // Administrator routes
      {
        path: 'admin',
        element: (
          <RoleGuard role="Administrator">
            <AdminDashboardPage />
          </RoleGuard>
        ),
      },
      {
        path: 'admin/incidents',
        element: (
          <RoleGuard role="Administrator">
            <AdminIncidentsPage />
          </RoleGuard>
        ),
      },
      {
        path: 'admin/users',
        element: (
          <RoleGuard role="Administrator">
            <AdminUsersPage />
          </RoleGuard>
        ),
      },

      // Default redirects per role
      {
        index: true,
        element: <RoleBasedRedirect />,
      },
    ],
  },
]);