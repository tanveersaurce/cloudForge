import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth.js';
import {
  handleCreateArchitecture,
  handleDeleteArchitecture,
  handleDuplicateArchitecture,
  handleGetArchitecture,
  handleListArchitectures,
  handleSaveArchitectureCanvas,
  handleUpdateArchitecture,
} from './architecture.controller.js';
import {
  handleGetValidationResults,
  handleValidateArchitecture,
} from '../validation/validation.controller.js';
import {
  handleApplyOptimization,
  handleGetCostAssumptions,
  handleGetCostEstimate,
  handlePostCostEstimate,
  handleSaveCostAssumptions,
} from '../pricing/pricing.controller.js';

export const architectureRouter = Router();

architectureRouter.use(requireAuth);

architectureRouter.get('/', handleListArchitectures);
architectureRouter.post('/', handleCreateArchitecture);
architectureRouter.get('/:id', handleGetArchitecture);
architectureRouter.patch('/:id', handleUpdateArchitecture);
architectureRouter.put('/:id/canvas', handleSaveArchitectureCanvas);
architectureRouter.post('/:id/duplicate', handleDuplicateArchitecture);
architectureRouter.delete('/:id', handleDeleteArchitecture);
architectureRouter.post('/:id/validate', handleValidateArchitecture);
architectureRouter.get('/:id/validation-results', handleGetValidationResults);
architectureRouter.get('/:id/cost-estimate', handleGetCostEstimate);
architectureRouter.post('/:id/cost-estimate', handlePostCostEstimate);
architectureRouter.get('/:id/cost-assumptions', handleGetCostAssumptions);
architectureRouter.post('/:id/cost-assumptions', handleSaveCostAssumptions);
architectureRouter.patch('/:id/cost-assumptions', handleSaveCostAssumptions);
architectureRouter.post('/:id/cost-optimizations/:recommendationId/apply', handleApplyOptimization);
