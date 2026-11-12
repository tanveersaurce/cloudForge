import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/database.js';
import { env } from '../config/env.js';
import type { AccessTokenPayload, AuthenticatedUser } from '../types/auth.types.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const ACCESS_COOKIE_NAME = 'cf_access_token';
export const REFRESH_COOKIE_NAME = 'cf_refresh_token';

const USER_PUBLIC_SELECT = {
  id: true,
  name: true,
  email: true,
  avatar: true,
  createdAt: true,
  updatedAt: true,
} as const;

async function resolveUserFromAccessToken(token: string): Promise<AuthenticatedUser> {
  let decoded: AccessTokenPayload;
  try {
    const verified = jwt.verify(token, env.JWT_ACCESS_SECRET);
    if (
      typeof verified !== 'object' ||
      verified === null ||
      verified.type !== 'access' ||
      typeof verified.sub !== 'string'
    ) {
      throw ApiError.unauthorized('Invalid authentication token', 'TOKEN_INVALID');
    }
    decoded = { sub: verified.sub, type: 'access' };
  } catch (err) {
    if (err instanceof ApiError) {
      throw err;
    }
    if (err instanceof jwt.TokenExpiredError) {
      throw ApiError.unauthorized('Access token expired', 'TOKEN_EXPIRED');
    }
    throw ApiError.unauthorized('Invalid authentication token', 'TOKEN_INVALID');
  }

  const user = await prisma.user.findUnique({
    where: { id: decoded.sub },
    select: USER_PUBLIC_SELECT,
  });

  if (!user) {
    throw ApiError.unauthorized('User session is no longer valid', 'USER_NOT_FOUND');
  }

  return user;
}

/**
 * Verifies the HttpOnly access token cookie and attaches the authenticated user to req.user.
 */
export const requireAuth = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const token = req.cookies?.[ACCESS_COOKIE_NAME] as string | undefined;

    if (!token) {
      throw ApiError.unauthorized('Authentication required', 'TOKEN_MISSING');
    }

    req.user = await resolveUserFromAccessToken(token);
    next();
  },
);

/**
 * Attaches req.user when a valid access cookie is present; proceeds anonymously otherwise.
 */
export const optionalAuth = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const token = req.cookies?.[ACCESS_COOKIE_NAME] as string | undefined;
    if (!token) {
      next();
      return;
    }

    try {
      req.user = await resolveUserFromAccessToken(token);
    } catch {
      req.user = undefined;
    }

    next();
  },
);
