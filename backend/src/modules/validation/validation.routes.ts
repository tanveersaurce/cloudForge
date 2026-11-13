import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth.js';
import {
  handleGetValidationRule,
  handleGetValidationResults,
  handleListValidationRules,
  handleValidateArchitecture,
} from './validation.controller.js';

export const validationRouter = Router();

// Public rule registry routes
validationRouter.get('/rules', handleListValidationRules);
validationRouter.get('/rules/:ruleId', handleGetValidationRule);

// Architecture validation routes (require authentication)
validationRouter.post(
  '/architectures/:id/validate',
  requireAuth,
  handleValidateArchitecture,
);

validationRouter.get(
  '/architectures/:id/validation-results',
  requireAuth,
  handleGetValidationResults,
);
