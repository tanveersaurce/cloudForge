import { checkDatabaseConnection } from '../../config/database.js';
import { getSystemMetadata } from '../../services/system.service.js';
import type { HealthCheckResult } from '../../types/api.types.js';

export async function getHealthStatus(): Promise<HealthCheckResult> {
  const metadata = getSystemMetadata();
  const dbCheck = await checkDatabaseConnection();

  return {
    status: dbCheck.connected ? 'ok' : 'degraded',
    ...metadata,
    database: {
      status: dbCheck.connected ? 'connected' : 'disconnected',
      latencyMs: dbCheck.latencyMs,
      ...(dbCheck.error ? { error: dbCheck.error } : {}),
    },
  };
}

export function getLivenessStatus() {
  return {
    status: 'ok' as const,
    ...getSystemMetadata(),
  };
}
