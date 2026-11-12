import { PrismaClient } from '@prisma/client';
import { env } from './env.js';
import { logger } from './logger.js';

declare global {
  var __cloudforgePrisma: PrismaClient | undefined;
}

export const prisma =
  globalThis.__cloudforgePrisma ??
  new PrismaClient({
    log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (env.NODE_ENV !== 'production') {
  globalThis.__cloudforgePrisma = prisma;
}

/**
 * Verifies active connectivity to PostgreSQL and returns measured round-trip latency in ms.
 */
export async function checkDatabaseConnection(): Promise<{ connected: boolean; latencyMs: number; error?: string }> {
  const startedAt = performance.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    const latencyMs = Math.round((performance.now() - startedAt) * 100) / 100;
    return { connected: true, latencyMs };
  } catch (err) {
    const latencyMs = Math.round((performance.now() - startedAt) * 100) / 100;
    const message = err instanceof Error ? err.message : 'Unknown database error';
    logger.warn({ err }, 'Database connectivity check failed');
    return { connected: false, latencyMs, error: message };
  }
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
}
