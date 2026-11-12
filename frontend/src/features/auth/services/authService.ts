import { apiFetch } from '@/services/apiClient';
import type { ApiSuccessResponse } from '@/types/api';
import type { AuthUser, LoginPayload, RegisterPayload } from '../types/auth.types';

export async function registerAccount(payload: RegisterPayload): Promise<AuthUser> {
  const res = await apiFetch<ApiSuccessResponse<{ user: AuthUser }>>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return res.data.user;
}

export async function loginAccount(payload: LoginPayload): Promise<AuthUser> {
  const res = await apiFetch<ApiSuccessResponse<{ user: AuthUser }>>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return res.data.user;
}

export async function refreshAuthSession(): Promise<AuthUser> {
  const res = await apiFetch<ApiSuccessResponse<{ user: AuthUser }>>('/auth/refresh', {
    method: 'POST',
    skipAuthRefresh: true,
  });
  return res.data.user;
}

export async function logoutAccount(): Promise<void> {
  await apiFetch<ApiSuccessResponse<{ loggedOut: boolean }>>('/auth/logout', {
    method: 'POST',
    skipAuthRefresh: true,
  });
}

export async function fetchCurrentUser(): Promise<AuthUser> {
  const res = await apiFetch<ApiSuccessResponse<{ user: AuthUser }>>('/auth/me');
  return res.data.user;
}
