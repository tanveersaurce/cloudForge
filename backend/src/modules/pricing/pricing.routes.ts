import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth.js';
import {
  handleApplyOptimization,
  handleGetCostAssumptions,
  handleGetCostEstimate,
  handleGetPricingForService,
  handleGetPricingRegions,
  handleGetPricingServices,
  handlePostCostEstimate,
  handleSaveCostAssumptions,
} from './pricing.controller.js';

export const pricingRouter = Router();

// Public catalog routes
pricingRouter.get('/services', handleGetPricingServices);
pricingRouter.get('/regions', handleGetPricingRegions);
pricingRouter.get('/services/:serviceCode', handleGetPricingForService);

// Architecture-specific cost estimation routes (require authentication)
pricingRouter.get('/architectures/:id/cost-estimate', requireAuth, handleGetCostEstimate);
pricingRouter.post('/architectures/:id/cost-estimate', requireAuth, handlePostCostEstimate);
pricingRouter.get('/architectures/:id/cost-assumptions', requireAuth, handleGetCostAssumptions);
pricingRouter.post('/architectures/:id/cost-assumptions', requireAuth, handleSaveCostAssumptions);
pricingRouter.patch('/architectures/:id/cost-assumptions', requireAuth, handleSaveCostAssumptions);
pricingRouter.post(
  '/architectures/:id/cost-optimizations/:recommendationId/apply',
  requireAuth,
  handleApplyOptimization,
);
