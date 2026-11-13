import type { Request, Response } from 'express';
import type { ApiResponse } from '../../types/api.types.js';
import { ApiError } from '../../utils/ApiError.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import type {
  ValidationEngineResult,
  ValidationRuleMetadata,
} from './types/validation.types.js';
import { ValidationService } from './validation.service.js';

function requireAuthenticatedUserId(req: Request): string {
  if (!req.user) {
    throw ApiError.unauthorized('Authentication required', 'UNAUTHORIZED');
  }
  return req.user.id;
}

export const handleValidateArchitecture = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireAuthenticatedUserId(req);
  const { id } = req.params;

  const result = await ValidationService.validateArchitecture(id, userId);

  const response: ApiResponse<ValidationEngineResult> = {
    success: true,
    data: result,
    timestamp: new Date().toISOString(),
  };

  res.status(200).json(response);
});

export const handleGetValidationResults = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireAuthenticatedUserId(req);
  const { id } = req.params;

  const result = await ValidationService.getValidationResults(id, userId);

  const response: ApiResponse<ValidationEngineResult> = {
    success: true,
    data: result,
    timestamp: new Date().toISOString(),
  };

  res.status(200).json(response);
});

export const handleListValidationRules = asyncHandler(async (_req: Request, res: Response) => {
  const rules = ValidationService.listRules();

  const response: ApiResponse<ValidationRuleMetadata[]> = {
    success: true,
    data: rules,
    timestamp: new Date().toISOString(),
  };

  res.status(200).json(response);
});

export const handleGetValidationRule = asyncHandler(async (req: Request, res: Response) => {
  const { ruleId } = req.params;
  const rule = ValidationService.getRule(ruleId);

  const response: ApiResponse<ValidationRuleMetadata> = {
    success: true,
    data: rule,
    timestamp: new Date().toISOString(),
  };

  res.status(200).json(response);
});
