import type { Request, Response } from 'express';
import type { ApiResponse } from '../../types/api.types.js';
import { ApiError } from '../../utils/ApiError.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  createArchitecture,
  deleteArchitecture,
  duplicateArchitecture,
  getArchitectureById,
  listUserArchitectures,
  saveArchitectureCanvas,
  updateArchitectureMetadata,
} from './architecture.service.js';
import type { ArchitectureDetailDto, ArchitectureSummaryDto } from './architecture.types.js';
import {
  architectureIdParamSchema,
  createArchitectureSchema,
  saveCanvasSchema,
  updateArchitectureSchema,
} from './architecture.validation.js';

function requireAuthenticatedUserId(req: Request): string {
  if (!req.user) {
    throw ApiError.unauthorized('Authentication required', 'UNAUTHORIZED');
  }
  return req.user.id;
}

export const handleListArchitectures = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireAuthenticatedUserId(req);
  const architectures = await listUserArchitectures(userId);

  const response: ApiResponse<ArchitectureSummaryDto[]> = {
    success: true,
    data: architectures,
    timestamp: new Date().toISOString(),
  };

  res.status(200).json(response);
});

export const handleCreateArchitecture = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireAuthenticatedUserId(req);
  const input = createArchitectureSchema.parse(req.body);
  const created = await createArchitecture(userId, input);

  const response: ApiResponse<ArchitectureDetailDto> = {
    success: true,
    data: created,
    timestamp: new Date().toISOString(),
  };

  res.status(201).json(response);
});

export const handleGetArchitecture = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireAuthenticatedUserId(req);
  const { id } = architectureIdParamSchema.parse(req.params);
  const architecture = await getArchitectureById(userId, id);

  const response: ApiResponse<ArchitectureDetailDto> = {
    success: true,
    data: architecture,
    timestamp: new Date().toISOString(),
  };

  res.status(200).json(response);
});

export const handleUpdateArchitecture = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireAuthenticatedUserId(req);
  const { id } = architectureIdParamSchema.parse(req.params);
  const input = updateArchitectureSchema.parse(req.body);
  const updated = await updateArchitectureMetadata(userId, id, input);

  const response: ApiResponse<ArchitectureDetailDto> = {
    success: true,
    data: updated,
    timestamp: new Date().toISOString(),
  };

  res.status(200).json(response);
});

export const handleSaveArchitectureCanvas = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireAuthenticatedUserId(req);
  const { id } = architectureIdParamSchema.parse(req.params);
  const input = saveCanvasSchema.parse(req.body);
  const updated = await saveArchitectureCanvas(userId, id, input);

  const response: ApiResponse<ArchitectureDetailDto> = {
    success: true,
    data: updated,
    timestamp: new Date().toISOString(),
  };

  res.status(200).json(response);
});

export const handleDuplicateArchitecture = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireAuthenticatedUserId(req);
  const { id } = architectureIdParamSchema.parse(req.params);
  const duplicated = await duplicateArchitecture(userId, id);

  const response: ApiResponse<ArchitectureDetailDto> = {
    success: true,
    data: duplicated,
    timestamp: new Date().toISOString(),
  };

  res.status(201).json(response);
});

export const handleDeleteArchitecture = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireAuthenticatedUserId(req);
  const { id } = architectureIdParamSchema.parse(req.params);
  const result = await deleteArchitecture(userId, id);

  const response: ApiResponse<{ deleted: true }> = {
    success: true,
    data: result,
    timestamp: new Date().toISOString(),
  };

  res.status(200).json(response);
});
