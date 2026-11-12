import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../config/database.js';
import { env } from '../../config/env.js';
import type {
  AuthenticatedUser,
  RefreshTokenPayload,
  SessionIssueResult,
} from '../../types/auth.types.js';
import { ApiError } from '../../utils/ApiError.js';
import type { LoginInput, RegisterInput } from './auth.validation.js';

const BCRYPT_COST = 12;

export interface SessionClientContext {
  userAgent?: string;
  ipAddress?: string;
}

const PUBLIC_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  avatar: true,
  createdAt: true,
  updatedAt: true,
} as const;

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function signAccessToken(userId: string): string {
  return jwt.sign({ sub: userId, type: 'access' }, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

function signRefreshToken(userId: string): string {
  return jwt.sign(
    { sub: userId, jti: crypto.randomUUID(), type: 'refresh' },
    env.JWT_REFRESH_SECRET,
    { expiresIn: `${env.JWT_REFRESH_EXPIRES_DAYS}d` },
  );
}

function computeRefreshExpiry(rememberMe: boolean): Date {
  const days = rememberMe ? env.JWT_REFRESH_EXPIRES_DAYS : 1;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

async function createSessionForUser(
  user: AuthenticatedUser,
  rememberMe: boolean,
  context: SessionClientContext,
): Promise<SessionIssueResult> {
  const accessToken = signAccessToken(user.id);
  const refreshToken = signRefreshToken(user.id);

  await prisma.refreshSession.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      userAgent: context.userAgent?.slice(0, 255),
      ipAddress: context.ipAddress?.slice(0, 64),
      expiresAt: computeRefreshExpiry(rememberMe),
    },
  });

  return { user, accessToken, refreshToken, rememberMe };
}

export async function registerUser(
  input: RegisterInput,
  context: SessionClientContext,
): Promise<SessionIssueResult> {
  const existing = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true },
  });

  if (existing) {
    throw ApiError.conflict('An account with this email address already exists', 'EMAIL_EXISTS');
  }

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_COST);

  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash,
    },
    select: PUBLIC_USER_SELECT,
  });

  return createSessionForUser(user, true, context);
}

export async function loginUser(
  input: LoginInput,
  context: SessionClientContext,
): Promise<SessionIssueResult> {
  const userWithHash = await prisma.user.findUnique({
    where: { email: input.email },
    select: {
      ...PUBLIC_USER_SELECT,
      passwordHash: true,
    },
  });

  if (!userWithHash) {
    throw ApiError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
  }

  const passwordValid = await bcrypt.compare(input.password, userWithHash.passwordHash);
  if (!passwordValid) {
    throw ApiError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
  }

  const { passwordHash: _omitted, ...user } = userWithHash;
  return createSessionForUser(user, input.rememberMe, context);
}

export async function rotateRefreshSession(
  rawRefreshToken: string | undefined,
  context: SessionClientContext,
): Promise<SessionIssueResult> {
  if (!rawRefreshToken) {
    throw ApiError.unauthorized('Refresh session token missing', 'REFRESH_TOKEN_MISSING');
  }

  let decoded: RefreshTokenPayload;
  try {
    const verified = jwt.verify(rawRefreshToken, env.JWT_REFRESH_SECRET);
    if (
      typeof verified !== 'object' ||
      verified === null ||
      verified.type !== 'refresh' ||
      typeof verified.sub !== 'string' ||
      typeof verified.jti !== 'string'
    ) {
      throw ApiError.unauthorized('Invalid refresh token', 'REFRESH_TOKEN_INVALID');
    }
    decoded = { sub: verified.sub, jti: verified.jti, type: 'refresh' };
  } catch (err) {
    if (err instanceof ApiError) {
      throw err;
    }
    throw ApiError.unauthorized('Refresh session expired or invalid', 'REFRESH_TOKEN_INVALID');
  }

  const tokenHash = hashToken(rawRefreshToken);
  const existingSession = await prisma.refreshSession.findUnique({
    where: { tokenHash },
    include: {
      user: {
        select: PUBLIC_USER_SELECT,
      },
    },
  });

  if (!existingSession || existingSession.userId !== decoded.sub) {
    throw ApiError.unauthorized('Refresh session not recognized', 'REFRESH_SESSION_INVALID');
  }

  if (existingSession.revokedAt !== null) {
    // Reuse of a revoked refresh token indicates possible token theft; revoke all active sessions for the user.
    await prisma.refreshSession.updateMany({
      where: { userId: existingSession.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw ApiError.unauthorized('Refresh session was already revoked', 'REFRESH_SESSION_REVOKED');
  }

  if (existingSession.expiresAt <= new Date()) {
    throw ApiError.unauthorized('Refresh session has expired', 'REFRESH_SESSION_EXPIRED');
  }

  const newAccessToken = signAccessToken(existingSession.userId);
  const newRefreshToken = signRefreshToken(existingSession.userId);
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    const revoked = await tx.refreshSession.updateMany({
      where: {
        id: existingSession.id,
        revokedAt: null,
      },
      data: { revokedAt: now },
    });

    if (revoked.count === 0) {
      throw ApiError.unauthorized('Refresh session already rotated', 'REFRESH_SESSION_REVOKED');
    }

    await tx.refreshSession.create({
      data: {
        userId: existingSession.userId,
        tokenHash: hashToken(newRefreshToken),
        userAgent: context.userAgent?.slice(0, 255),
        ipAddress: context.ipAddress?.slice(0, 64),
        expiresAt: new Date(
          now.getTime() + env.JWT_REFRESH_EXPIRES_DAYS * 24 * 60 * 60 * 1000,
        ),
      },
    });
  });

  return {
    user: existingSession.user,
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
    rememberMe: true,
  };
}

export async function revokeRefreshSession(rawRefreshToken: string | undefined): Promise<void> {
  if (!rawRefreshToken) {
    return;
  }

  const tokenHash = hashToken(rawRefreshToken);
  await prisma.refreshSession.updateMany({
    where: {
      tokenHash,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });
}
