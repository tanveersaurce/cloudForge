import type { Request, Response } from 'express';
import type { ApiResponse } from '../../types/api.types.js';
import { ApiError } from '../../utils/ApiError.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { TerraformGenerator } from './terraform-generator.service.js';
import type { ExportMode } from './terraform.types.js';

function requireAuthenticatedUserId(req: Request): string {
  if (!req.user) {
    throw ApiError.unauthorized('Authentication required', 'UNAUTHORIZED');
  }
  return req.user.id;
}

interface TerraformGenerateResponse {
  files: Array<{ filename: string; content: string }>;
  hcl: string;
  totalFiles: number;
  mode: ExportMode;
  issues: Array<{
    nodeId: string;
    resourceType: string;
    missing: string;
    severity: 'error' | 'warning';
  }>;
}

export const handleGenerateTerraform = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireAuthenticatedUserId(req);
  const { id } = req.params;

  // Extract export mode from request body or query parameter
  const rawMode = req.body?.mode || req.query?.mode;
  const mode: ExportMode = rawMode === 'modular' ? 'modular' : 'standard';

  const { files, hcl, issues, mode: generatedMode } = await TerraformGenerator.generateAndSave(id, userId, { mode });

  const response: ApiResponse<TerraformGenerateResponse> = {
    success: true,
    data: {
      files,
      hcl,
      totalFiles: files.length,
      mode: generatedMode,
      issues,
    },
    timestamp: new Date().toISOString(),
  };
  res.status(200).json(response);
});
