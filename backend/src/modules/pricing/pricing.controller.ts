import type { Request, Response } from 'express';
import type { ApiResponse } from '../../types/api.types.js';
import { ApiError } from '../../utils/ApiError.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { PricingService } from './pricing.service.js';
import type {
  CostEstimationResult,
  PricingDimensionRate,
  WorkloadAssumptions,
} from './types/pricing.types.js';

function requireAuthenticatedUserId(req: Request): string {
  if (!req.user) {
    throw ApiError.unauthorized('Authentication required', 'UNAUTHORIZED');
  }
  return req.user.id;
}

export const handleGetPricingServices = asyncHandler(async (_req: Request, res: Response) => {
  const services = PricingService.getServices();
  const response: ApiResponse<typeof services> = {
    success: true,
    data: services,
    timestamp: new Date().toISOString(),
  };
  res.status(200).json(response);
});

export const handleGetPricingRegions = asyncHandler(async (_req: Request, res: Response) => {
  const regions = PricingService.getRegions();
  const response: ApiResponse<typeof regions> = {
    success: true,
    data: regions,
    timestamp: new Date().toISOString(),
  };
  res.status(200).json(response);
});

export const handleGetPricingForService = asyncHandler(async (req: Request, res: Response) => {
  const { serviceCode } = req.params;
  const region = (req.query.region as string) || 'us-east-1';

  const rates = PricingService.getServicePricing(serviceCode, region);
  const response: ApiResponse<PricingDimensionRate[]> = {
    success: true,
    data: rates,
    timestamp: new Date().toISOString(),
  };
  res.status(200).json(response);
});

export const handleGetCostEstimate = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireAuthenticatedUserId(req);
  const { id } = req.params;

  const estimate = await PricingService.calculateCost(id, userId);
  const response: ApiResponse<CostEstimationResult> = {
    success: true,
    data: estimate,
    timestamp: new Date().toISOString(),
  };
  res.status(200).json(response);
});

export const handlePostCostEstimate = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireAuthenticatedUserId(req);
  const { id } = req.params;
  const overrideAssumptions = req.body.assumptions;

  const estimate = await PricingService.calculateCost(id, userId, overrideAssumptions);
  const response: ApiResponse<CostEstimationResult> = {
    success: true,
    data: estimate,
    timestamp: new Date().toISOString(),
  };
  res.status(200).json(response);
});

export const handleGetCostAssumptions = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireAuthenticatedUserId(req);
  const { id } = req.params;

  const assumptions = await PricingService.getCostAssumptions(id, userId);
  const response: ApiResponse<WorkloadAssumptions> = {
    success: true,
    data: assumptions,
    timestamp: new Date().toISOString(),
  };
  res.status(200).json(response);
});

export const handleSaveCostAssumptions = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireAuthenticatedUserId(req);
  const { id } = req.params;
  const patch = req.body;

  const updated = await PricingService.saveCostAssumptions(id, userId, patch);
  const response: ApiResponse<WorkloadAssumptions> = {
    success: true,
    data: updated,
    timestamp: new Date().toISOString(),
  };
  res.status(200).json(response);
});

export const handleApplyOptimization = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireAuthenticatedUserId(req);
  const { id, recommendationId } = req.params;

  const result = await PricingService.applyOptimization(id, userId, recommendationId);
  const response: ApiResponse<CostEstimationResult> = {
    success: true,
    data: result,
    timestamp: new Date().toISOString(),
  };
  res.status(200).json(response);
});
