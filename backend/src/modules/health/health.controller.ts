import type { Request, Response } from 'express';
import type { ApiResponse, HealthCheckResult } from '../../types/api.types.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { getHealthStatus, getLivenessStatus } from './health.service.js';

export const handleGetHealth = asyncHandler(async (_req: Request, res: Response) => {
  const health = await getHealthStatus();
  const statusCode = health.database.status === 'connected' ? 200 : 503;

  const response: ApiResponse<HealthCheckResult> = {
    success: true,
    data: health,
    timestamp: new Date().toISOString(),
  };

  res.status(statusCode).json(response);
});

export function handleGetLiveness(_req: Request, res: Response): void {
  res.status(200).json({
    success: true,
    data: getLivenessStatus(),
    timestamp: new Date().toISOString(),
  });
}
