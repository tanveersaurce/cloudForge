import type { Request, Response } from 'express';
import type { ApiResponse } from '../../types/api.types.js';
import { ApiError } from '../../utils/ApiError.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { getDashboardOverview, type DashboardOverviewData } from './dashboard.service.js';

export const handleGetDashboardOverview = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw ApiError.unauthorized('Authentication required', 'UNAUTHORIZED');
  }

  const overview = await getDashboardOverview(req.user);

  const response: ApiResponse<DashboardOverviewData> = {
    success: true,
    data: overview,
    timestamp: new Date().toISOString(),
  };

  res.status(200).json(response);
});
