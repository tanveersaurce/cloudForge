import { create } from 'zustand';
import {
  fetchCurrentUser,
  loginAccount,
  logoutAccount,
  registerAccount,
} from '@/features/auth/services/authService';
import type {
  AuthStatus,
  AuthUser,
  LoginPayload,
  RegisterPayload,
} from '@/features/auth/types/auth.types';
import { ApiClientError, registerUnauthorizedHandler } from '@/services/apiClient';

interface AuthState {
  user: AuthUser | null;
  status: AuthStatus;
  error: string | null;
  initializeSession: () => Promise<void>;
  login: (payload: LoginPayload) => Promise<AuthUser>;
  register: (payload: RegisterPayload) => Promise<AuthUser>;
  logout: () => Promise<void>;
  clearError: () => void;
  setUnauthenticated: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  status: 'idle',
  error: null,

  initializeSession: async () => {
    if (get().status === 'loading') return;
    set({ status: 'loading', error: null });

    try {
      // apiFetch automatically invokes POST /api/auth/refresh once on 401 before failing.
      const user = await fetchCurrentUser();
      set({ user, status: 'authenticated', error: null });
    } catch {
      set({ user: null, status: 'unauthenticated', error: null });
    }
  },

  login: async (payload) => {
    set({ error: null });
    try {
      const user = await loginAccount(payload);
      set({ user, status: 'authenticated', error: null });
      return user;
    } catch (err) {
      const message =
        err instanceof ApiClientError ? err.message : 'Unable to sign in right now';
      set({ error: message });
      throw err;
    }
  },

  register: async (payload) => {
    set({ error: null });
    try {
      const user = await registerAccount(payload);
      set({ user, status: 'authenticated', error: null });
      return user;
    } catch (err) {
      const message =
        err instanceof ApiClientError ? err.message : 'Unable to create account right now';
      set({ error: message });
      throw err;
    }
  },

  logout: async () => {
    try {
      await logoutAccount();
    } finally {
      set({ user: null, status: 'unauthenticated', error: null });
    }
  },

  clearError: () => set({ error: null }),

  setUnauthenticated: () => set({ user: null, status: 'unauthenticated' }),
}));

registerUnauthorizedHandler(() => {
  useAuthStore.getState().setUnauthenticated();
});
