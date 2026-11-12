import type { CookieOptions, Response } from 'express';
import { env } from '../../config/env.js';
import { ACCESS_COOKIE_NAME, REFRESH_COOKIE_NAME } from '../../middleware/requireAuth.js';

const ACCESS_MAX_AGE_MS = 15 * 60 * 1000;

function baseCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: 'lax',
    path: '/',
    ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
  };
}

export function setAuthCookies(
  res: Response,
  accessToken: string,
  refreshToken: string,
  rememberMe: boolean,
): void {
  const base = baseCookieOptions();

  res.cookie(ACCESS_COOKIE_NAME, accessToken, {
    ...base,
    maxAge: ACCESS_MAX_AGE_MS,
  });

  const refreshMaxAgeMs = env.JWT_REFRESH_EXPIRES_DAYS * 24 * 60 * 60 * 1000;

  res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
    ...base,
    ...(rememberMe ? { maxAge: refreshMaxAgeMs } : {}),
  });
}

export function clearAuthCookies(res: Response): void {
  const base = baseCookieOptions();
  res.clearCookie(ACCESS_COOKIE_NAME, base);
  res.clearCookie(REFRESH_COOKIE_NAME, base);
}
