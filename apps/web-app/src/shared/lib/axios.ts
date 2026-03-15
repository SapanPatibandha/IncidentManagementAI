import axios from 'axios';
import { useAuthStore } from '../../features/auth/store/authStore';

// Create axios instance
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_GATEWAY_URL || 'http://localhost:8080',
});

// Attach access token to every request
api.interceptors.request.use((config) => {
  const { accessToken } = useAuthStore.getState();
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// Silent refresh on 401
let isRefreshing = false;
let refreshQueue: Array<(token: string) => void> = [];

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status !== 401) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      // If refresh is already in progress, queue the request
      return new Promise((resolve) => {
        refreshQueue.push((token: string) => {
          error.config.headers.Authorization = `Bearer ${token}`;
          resolve(api(error.config));
        });
      });
    }

    isRefreshing = true;

    try {
      // Attempt to refresh the token
      const refreshResponse = await axios.post('/auth/refresh', {}, {
        baseURL: import.meta.env.VITE_IDENTITY_SERVICE_URL || 'http://localhost:8080',
      });

      const { accessToken: newAccessToken } = refreshResponse.data;

      // Update the store with the new token
      useAuthStore.getState().setAccessToken(newAccessToken);

      // Resolve all queued requests with the new token
      refreshQueue.forEach((callback) => callback(newAccessToken));
      refreshQueue = [];

      // Retry the original request with the new token
      error.config.headers.Authorization = `Bearer ${newAccessToken}`;
      return api(error.config);
    } catch (refreshError) {
      // Refresh failed, logout the user
      useAuthStore.getState().logout();
      window.location.href = '/login';
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);