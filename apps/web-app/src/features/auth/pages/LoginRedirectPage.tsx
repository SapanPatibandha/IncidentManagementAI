import { useEffect } from 'react';

export function LoginRedirectPage() {
  useEffect(() => {
    // Redirect to IdentityService OAuth login
    const identityServiceUrl = import.meta.env.VITE_IDENTITY_SERVICE_URL || 'http://localhost:8080';
    window.location.href = `${identityServiceUrl}/auth/login?redirect_uri=${encodeURIComponent(window.location.origin + '/auth/callback')}`;
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-muted">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-500 mx-auto mb-4"></div>
        <p className="text-gray-600">Redirecting to login...</p>
      </div>
    </div>
  );
}