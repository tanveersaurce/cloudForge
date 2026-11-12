import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

interface StoredUser {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  avatar: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface StoredSession {
  id: string;
  userId: string;
  tokenHash: string;
  userAgent: string | null;
  ipAddress: string | null;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
}

const users: StoredUser[] = [];
const sessions: StoredSession[] = [];
let seq = 1;

function pickUser(user: StoredUser, select?: Record<string, boolean>) {
  if (!select) return { ...user };
  const out: Record<string, unknown> = {};
  for (const [key, enabled] of Object.entries(select)) {
    if (enabled) {
      out[key] = user[key as keyof StoredUser];
    }
  }
  return out;
}

const mockPrisma = {
  $queryRaw: vi.fn(async () => [{ '?column?': 1 }]),
  $disconnect: vi.fn(async () => undefined),
  $transaction: vi.fn(async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma)),
  user: {
    findUnique: vi.fn(
      async ({
        where,
        select,
      }: {
        where: { id?: string; email?: string };
        select?: Record<string, boolean>;
      }) => {
        const found = users.find((u) =>
          where.id ? u.id === where.id : u.email === where.email,
        );
        return found ? pickUser(found, select) : null;
      },
    ),
    create: vi.fn(
      async ({
        data,
        select,
      }: {
        data: { name: string; email: string; passwordHash: string };
        select?: Record<string, boolean>;
      }) => {
        const now = new Date();
        const created: StoredUser = {
          id: `user-${seq++}`,
          name: data.name,
          email: data.email,
          passwordHash: data.passwordHash,
          avatar: null,
          createdAt: now,
          updatedAt: now,
        };
        users.push(created);
        return pickUser(created, select);
      },
    ),
  },
  refreshSession: {
    create: vi.fn(
      async ({
        data,
      }: {
        data: {
          userId: string;
          tokenHash: string;
          userAgent?: string;
          ipAddress?: string;
          expiresAt: Date;
        };
      }) => {
        const created: StoredSession = {
          id: `sess-${seq++}`,
          userId: data.userId,
          tokenHash: data.tokenHash,
          userAgent: data.userAgent ?? null,
          ipAddress: data.ipAddress ?? null,
          expiresAt: data.expiresAt,
          revokedAt: null,
          createdAt: new Date(),
        };
        sessions.push(created);
        return created;
      },
    ),
    findUnique: vi.fn(
      async ({
        where,
        include,
      }: {
        where: { tokenHash: string };
        include?: { user?: { select?: Record<string, boolean> } };
      }) => {
        const found = sessions.find((s) => s.tokenHash === where.tokenHash);
        if (!found) return null;
        if (!include?.user) return { ...found };
        const owner = users.find((u) => u.id === found.userId);
        return {
          ...found,
          user: owner ? pickUser(owner, include.user.select) : null,
        };
      },
    ),
    updateMany: vi.fn(
      async ({
        where,
        data,
      }: {
        where: { id?: string; userId?: string; tokenHash?: string; revokedAt?: null };
        data: { revokedAt: Date };
      }) => {
        let count = 0;
        for (const sess of sessions) {
          const matchesId = where.id ? sess.id === where.id : true;
          const matchesUser = where.userId ? sess.userId === where.userId : true;
          const matchesHash = where.tokenHash ? sess.tokenHash === where.tokenHash : true;
          const matchesRevoked = where.revokedAt === null ? sess.revokedAt === null : true;
          if (matchesId && matchesUser && matchesHash && matchesRevoked) {
            sess.revokedAt = data.revokedAt;
            count += 1;
          }
        }
        return { count };
      },
    ),
  },
  architecture: {
    count: vi.fn(async () => 0),
    findMany: vi.fn(async () => []),
  },
  userServiceHistory: {
    count: vi.fn(async () => 0),
    findMany: vi.fn(async () => []),
  },
  userFavoriteService: {
    findMany: vi.fn(async () => []),
  },
  awsService: {
    count: vi.fn(async () => 56),
  },
};

vi.mock('../../config/database.js', () => ({
  prisma: mockPrisma,
  checkDatabaseConnection: vi.fn(async () => ({ connected: true, latencyMs: 1.2 })),
  disconnectDatabase: vi.fn(async () => undefined),
}));

const { createApp } = await import('../../app.js');

function extractCookieValue(setCookieHeaders: string[] | undefined, name: string): string | undefined {
  if (!setCookieHeaders) return undefined;
  const target = setCookieHeaders.find((c) => c.startsWith(`${name}=`));
  if (!target) return undefined;
  return target.split(';')[0];
}

describe('Authentication, Session Rotation, and Protected Dashboard APIs', () => {
  const app = createApp();

  beforeEach(() => {
    users.length = 0;
    sessions.length = 0;
    seq = 1;
    vi.clearAllMocks();
  });

  const validUser = {
    name: 'Aarav Sharma',
    email: 'aarav@cloudforge.dev',
    password: 'StrongPassword!2026',
  };

  it('registers a user successfully, sets HttpOnly cookies, and never exposes passwordHash', async () => {
    const res = await request(app).post('/api/auth/register').send(validUser);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user).toMatchObject({
      name: 'Aarav Sharma',
      email: 'aarav@cloudforge.dev',
    });
    expect(res.body.data.user.passwordHash).toBeUndefined();

    const cookies = res.headers['set-cookie'] as unknown as string[];
    expect(cookies.some((c) => c.startsWith('cf_access_token=') && c.includes('HttpOnly'))).toBe(
      true,
    );
    expect(cookies.some((c) => c.startsWith('cf_refresh_token=') && c.includes('HttpOnly'))).toBe(
      true,
    );
  });

  it('rejects duplicate email registration with 409', async () => {
    await request(app).post('/api/auth/register').send(validUser);
    const res = await request(app).post('/api/auth/register').send(validUser);

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('EMAIL_EXISTS');
  });

  it('rejects invalid email with 400 validation error', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...validUser, email: 'not-an-email' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects weak password with 400 validation error', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...validUser, password: 'weak' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('logs in successfully with valid credentials and rejects incorrect password', async () => {
    await request(app).post('/api/auth/register').send(validUser);

    const badLogin = await request(app).post('/api/auth/login').send({
      email: validUser.email,
      password: 'WrongPassword!123',
    });
    expect(badLogin.status).toBe(401);
    expect(badLogin.body.error.code).toBe('INVALID_CREDENTIALS');

    const goodLogin = await request(app).post('/api/auth/login').send({
      email: validUser.email,
      password: validUser.password,
    });
    expect(goodLogin.status).toBe(200);
    expect(goodLogin.body.data.user.email).toBe(validUser.email);
    expect(goodLogin.body.data.user.passwordHash).toBeUndefined();
  });

  it('protects /api/auth/me and /api/dashboard/overview and rejects invalid tokens', async () => {
    const unauthMe = await request(app).get('/api/auth/me');
    expect(unauthMe.status).toBe(401);

    const unauthDash = await request(app).get('/api/dashboard/overview');
    expect(unauthDash.status).toBe(401);

    const badToken = await request(app)
      .get('/api/auth/me')
      .set('Cookie', ['cf_access_token=tampered.jwt.token']);
    expect(badToken.status).toBe(401);
    expect(badToken.body.error.code).toBe('TOKEN_INVALID');

    const regRes = await request(app).post('/api/auth/register').send(validUser);
    const accessCookie = extractCookieValue(
      regRes.headers['set-cookie'] as unknown as string[],
      'cf_access_token',
    );

    const meRes = await request(app).get('/api/auth/me').set('Cookie', [accessCookie!]);
    expect(meRes.status).toBe(200);
    expect(meRes.body.data.user.email).toBe(validUser.email);

    const dashRes = await request(app)
      .get('/api/dashboard/overview')
      .set('Cookie', [accessCookie!]);
    expect(dashRes.status).toBe(200);
    expect(dashRes.body.data.metrics.totalArchitectures).toBe(0);
    expect(dashRes.body.data.metrics.savedProjects).toBe(0);
    expect(dashRes.body.data.metrics.awsServicesExplored.available).toBe(true);
    expect(dashRes.body.data.metrics.awsServicesExplored.value).toBe(0);
    expect(dashRes.body.data.metrics.estimatedMonthlyCost.available).toBe(false);
    expect(dashRes.body.data.recentArchitectures).toEqual([]);
  });

  it('rotates refresh tokens and revokes sessions upon reuse or logout', async () => {
    const regRes = await request(app).post('/api/auth/register').send(validUser);
    const initialCookies = regRes.headers['set-cookie'] as unknown as string[];
    const initialRefresh = extractCookieValue(initialCookies, 'cf_refresh_token')!;

    // First refresh succeeds and issues rotated token
    const refreshRes = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', [initialRefresh]);
    expect(refreshRes.status).toBe(200);

    const rotatedCookies = refreshRes.headers['set-cookie'] as unknown as string[];
    const rotatedRefresh = extractCookieValue(rotatedCookies, 'cf_refresh_token')!;
    const rotatedAccess = extractCookieValue(rotatedCookies, 'cf_access_token')!;
    expect(rotatedRefresh).not.toBe(initialRefresh);

    // Reusing the old rotated refresh token is rejected and revokes active sessions
    const reuseRes = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', [initialRefresh]);
    expect(reuseRes.status).toBe(401);
    expect(reuseRes.body.error.code).toBe('REFRESH_SESSION_REVOKED');

    // Rotated session was also revoked by reuse detection
    const afterReuseRefresh = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', [rotatedRefresh]);
    expect(afterReuseRefresh.status).toBe(401);

    // Re-login and verify logout revokes refresh session
    const loginRes = await request(app).post('/api/auth/login').send({
      email: validUser.email,
      password: validUser.password,
    });
    const loginRefresh = extractCookieValue(
      loginRes.headers['set-cookie'] as unknown as string[],
      'cf_refresh_token',
    )!;

    const logoutRes = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', [loginRefresh, rotatedAccess]);
    expect(logoutRes.status).toBe(200);
    expect(logoutRes.body.data.loggedOut).toBe(true);

    const refreshAfterLogout = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', [loginRefresh]);
    expect(refreshAfterLogout.status).toBe(401);
  });
});
