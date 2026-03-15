import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export function OAuthCallbackPage() {
  const navigate = useNavigate();
  const { setAccessToken, setUser } = useAuthStore();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');

        if (!code) {
          throw new Error('No authorization code received');
        }

        // Exchange code for tokens
        const identityServiceUrl = import.meta.env.VITE_IDENTITY_SERVICE_URL || 'http://localhost:8080';
        const response = await fetch(`${identityServiceUrl}/auth/token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            grant_type: 'authorization_code',
            code,
            redirect_uri: window.location.origin + '/auth/callback',
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to exchange code for tokens');
        }

        const { access_token, user } = await response.json();

        // Store tokens and user info
        setAccessToken(access_token);
        setUser(user);

        // Redirect to role-based default page
        navigate('/', { replace: true });
      } catch (error) {
        console.error('OAuth callback failed:', error);
        // Redirect to login on error
        navigate('/login', { replace: true });
      }
    };

    handleCallback();
  }, [navigate, setAccessToken, setUser]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-muted">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-500 mx-auto mb-4"></div>
        <p className="text-gray-600">Completing login...</p>
      </div>
    </div>
  );
}