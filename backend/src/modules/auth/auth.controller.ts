import type { Request, Response } from 'express';
import { REFRESH_COOKIE_NAME } from '../../middleware/requireAuth.js';
import type { ApiResponse } from '../../types/api.types.js';
import type { AuthenticatedUser } from '../../types/auth.types.js';
import { ApiError } from '../../utils/ApiError.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { clearAuthCookies, setAuthCookies } from './auth.cookies.js';
import {
  loginUser,
  registerUser,
  revokeRefreshSession,
  rotateRefreshSession,
  type SessionClientContext,
} from './auth.service.js';
import { loginSchema, registerSchema } from './auth.validation.js';

function getClientContext(req: Request): SessionClientContext {
  return {
    userAgent: req.get('user-agent'),
    ipAddress: req.ip,
  };
}

export const handleRegister = asyncHandler(async (req: Request, res: Response) => {
  const input = registerSchema.parse(req.body);
  const result = await registerUser(input, getClientContext(req));

  setAuthCookies(res, result.accessToken, result.refreshToken, result.rememberMe);

  const response: ApiResponse<{ user: AuthenticatedUser }> = {
    success: true,
    data: { user: result.user },
    timestamp: new Date().toISOString(),
  };

  res.status(201).json(response);
});

export const handleLogin = asyncHandler(async (req: Request, res: Response) => {
  const input = loginSchema.parse(req.body);
  const result = await loginUser(input, getClientContext(req));

  setAuthCookies(res, result.accessToken, result.refreshToken, result.rememberMe);

  const response: ApiResponse<{ user: AuthenticatedUser }> = {
    success: true,
    data: { user: result.user },
    timestamp: new Date().toISOString(),
  };

  res.status(200).json(response);
});

export const handleRefresh = asyncHandler(async (req: Request, res: Response) => {
  const rawRefreshToken = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;

  try {
    const result = await rotateRefreshSession(rawRefreshToken, getClientContext(req));
    setAuthCookies(res, result.accessToken, result.refreshToken, result.rememberMe);

    const response: ApiResponse<{ user: AuthenticatedUser }> = {
      success: true,
      data: { user: result.user },
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(response);
  } catch (err) {
    clearAuthCookies(res);
    throw err;
  }
});

export const handleLogout = asyncHandler(async (req: Request, res: Response) => {
  const rawRefreshToken = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
  await revokeRefreshSession(rawRefreshToken);
  clearAuthCookies(res);

  const response: ApiResponse<{ loggedOut: boolean }> = {
    success: true,
    data: { loggedOut: true },
    timestamp: new Date().toISOString(),
  };

  res.status(200).json(response);
});

export function handleGetMe(req: Request, res: Response): void {
  if (!req.user) {
    throw ApiError.unauthorized('Authentication required', 'UNAUTHORIZED');
  }

  const response: ApiResponse<{ user: AuthenticatedUser }> = {
    success: true,
    data: { user: req.user },
    timestamp: new Date().toISOString(),
  };

  res.status(200).json(response);
}
