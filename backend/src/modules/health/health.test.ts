import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const checkDatabaseConnectionMock = vi.fn();

vi.mock('../../config/database.js', () => ({
  checkDatabaseConnection: checkDatabaseConnectionMock,
  disconnectDatabase: vi.fn(),
  prisma: {},
}));

const { createApp } = await import('../../app.js');

describe('Backend Health & Error Handling API', () => {
  const app = createApp();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET /api/health/live returns 200 with service metadata', async () => {
    const response = await request(app).get('/api/health/live');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toMatchObject({
      status: 'ok',
      service: 'cloudforge-api',
      version: '0.1.0',
    });
  });

  it('GET /api/health returns 200 when database is connected', async () => {
    checkDatabaseConnectionMock.mockResolvedValue({
      connected: true,
      latencyMs: 3.42,
    });

    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toMatchObject({
      status: 'ok',
      database: {
        status: 'connected',
        latencyMs: 3.42,
      },
    });
  });

  it('GET /api/health returns 503 when database is disconnected', async () => {
    checkDatabaseConnectionMock.mockResolvedValue({
      connected: false,
      latencyMs: 12.1,
      error: 'Connection refused',
    });

    const response = await request(app).get('/api/health');

    expect(response.status).toBe(503);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toMatchObject({
      status: 'degraded',
      database: {
        status: 'disconnected',
        error: 'Connection refused',
      },
    });
  });

  it('returns standardized 404 JSON for unknown routes', async () => {
    const response = await request(app).get('/api/non-existent-route');

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});
