import { redirect } from 'react-router-dom';
import { useAuthStore } from '../../features/auth/store/authStore';

export async function requireAuth() {
  const { accessToken } = useAuthStore.getState();

  if (!accessToken) {
    // Redirect to login if no token
    return redirect('/login');
  }

  // Token exists, allow the route to load
  return null;
}