import { create } from 'zustand';

export type UserRole = 'Incident Creator' | 'Issue Responder' | 'Administrator';

export interface User {
  userId: string;
  email: string;
  role: UserRole;
}

interface AuthStore {
  accessToken: string | null;
  user: User | null;
  setAccessToken: (token: string) => void;
  setUser: (user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  accessToken: null,
  user: null,
  setAccessToken: (accessToken) => set({ accessToken }),
  setUser: (user) => set({ user }),
  logout: () => set({ accessToken: null, user: null }),
}));