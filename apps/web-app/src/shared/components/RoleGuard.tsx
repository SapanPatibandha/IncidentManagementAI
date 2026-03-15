import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../features/auth/store/authStore';

interface RoleGuardProps {
  role: 'Incident Creator' | 'Issue Responder' | 'Administrator';
  children: ReactNode;
}

export function RoleGuard({ role, children }: RoleGuardProps) {
  const { user } = useAuthStore();

  if (!user || user.role !== role) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}