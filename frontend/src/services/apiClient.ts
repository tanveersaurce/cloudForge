const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, '') || 'http://localhost:4000/api';

export class ApiClientError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(message: string, status: number, code = 'API_ERROR', details?: unknown) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

interface ErrorEnvelope {
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
}

let refreshPromise: Promise<boolean> | null = null;
let unauthorizedHandler: (() => void) | null = null;

export function registerUnauthorizedHandler(handler: () => void): void {
  unauthorizedHandler = handler;
}

async function attemptSessionRefresh(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    })
      .then((res) => res.ok)
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

const AUTH_NO_RETRY_PATHS = new Set([
  '/auth/login',
  '/auth/register',
  '/auth/refresh',
  '/auth/logout',
]);

export interface ApiFetchOptions extends RequestInit {
  skipAuthRefresh?: boolean;
}

export async function apiFetch<T>(path: string, init?: ApiFetchOptions): Promise<T> {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const { skipAuthRefresh = false, ...fetchInit } = init ?? {};

  const response = await fetch(`${API_BASE_URL}${normalizedPath}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...fetchInit.headers,
    },
    ...fetchInit,
  });

  if (
    response.status === 401 &&
    !skipAuthRefresh &&
    !AUTH_NO_RETRY_PATHS.has(normalizedPath)
  ) {
    const refreshed = await attemptSessionRefresh();
    if (refreshed) {
      return apiFetch<T>(normalizedPath, { ...init, skipAuthRefresh: true });
    }
    unauthorizedHandler?.();
  }

  const payload = (await response.json().catch(() => null)) as (T & ErrorEnvelope) | null;

  if (!response.ok && response.status !== 503) {
    const message = payload?.error?.message || `Request failed with status ${response.status}`;
    const code = payload?.error?.code || 'API_ERROR';
    throw new ApiClientError(message, response.status, code, payload?.error?.details);
  }

  if (!payload) {
    throw new ApiClientError('Empty response received from API server', response.status);
  }

  return payload as T;
}
