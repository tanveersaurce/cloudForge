import { useAuthStore } from '@/store/useAuthStore';

export function useAuth() {
  const user = useAuthStore((state) => state.user);
  const status = useAuthStore((state) => state.status);
  const error = useAuthStore((state) => state.error);
  const login = useAuthStore((state) => state.login);
  const register = useAuthStore((state) => state.register);
  const logout = useAuthStore((state) => state.logout);
  const clearError = useAuthStore((state) => state.clearError);
  const initializeSession = useAuthStore((state) => state.initializeSession);

  return {
    user,
    status,
    error,
    isAuthenticated: status === 'authenticated' && user !== null,
    isLoading: status === 'idle' || status === 'loading',
    login,
    register,
    logout,
    clearError,
    initializeSession,
  };
}
