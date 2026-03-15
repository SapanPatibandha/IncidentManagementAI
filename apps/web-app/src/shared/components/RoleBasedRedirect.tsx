import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../features/auth/store/authStore';

export function RoleBasedRedirect() {
  const { user } = useAuthStore();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const redirects = {
    'Incident Creator': '/dashboard',
    'Issue Responder': '/queue',
    'Administrator': '/admin',
  };

  return <Navigate to={redirects[user.role]} replace />;
}