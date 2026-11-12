import type { Request, Response } from 'express';
import { ApiError } from '../../utils/ApiError.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  addFavoriteService,
  getAwsServiceBySlug,
  listAwsCategories,
  listAwsServices,
  listRecentlyExploredServices,
  listUserFavoriteServices,
  recordServiceExploration,
  removeFavoriteService,
} from './aws.service.js';
import {
  listServicesQuerySchema,
  paginationQuerySchema,
  searchServicesQuerySchema,
  serviceIdParamSchema,
  serviceSlugParamSchema,
} from './aws.validation.js';

function requireAuthenticatedUserId(req: Request): string {
  if (!req.user) {
    throw ApiError.unauthorized('Authentication required', 'UNAUTHORIZED');
  }
  return req.user.id;
}

export const handleListCategories = asyncHandler(async (_req: Request, res: Response) => {
  const categories = await listAwsCategories();
  res.status(200).json({
    success: true,
    data: { categories },
    timestamp: new Date().toISOString(),
  });
});

export const handleListServices = asyncHandler(async (req: Request, res: Response) => {
  const query = listServicesQuerySchema.parse(req.query);
  const result = await listAwsServices(query, req.user?.id);

  res.status(200).json({
    success: true,
    data: result,
    timestamp: new Date().toISOString(),
  });
});

export const handleSearchServices = asyncHandler(async (req: Request, res: Response) => {
  const query = searchServicesQuerySchema.parse(req.query);
  const result = await listAwsServices(query, req.user?.id);

  res.status(200).json({
    success: true,
    data: result,
    timestamp: new Date().toISOString(),
  });
});

export const handleGetServiceBySlug = asyncHandler(async (req: Request, res: Response) => {
  const { slug } = serviceSlugParamSchema.parse(req.params);
  const service = await getAwsServiceBySlug(slug, req.user?.id);

  res.status(200).json({
    success: true,
    data: { service },
    timestamp: new Date().toISOString(),
  });
});

export const handleListFavorites = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireAuthenticatedUserId(req);
  const pagination = paginationQuerySchema.parse(req.query);
  const result = await listUserFavoriteServices(userId, pagination);

  res.status(200).json({
    success: true,
    data: result,
    timestamp: new Date().toISOString(),
  });
});

export const handleAddFavorite = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireAuthenticatedUserId(req);
  const { id } = serviceIdParamSchema.parse(req.params);
  const result = await addFavoriteService(userId, id);

  res.status(200).json({
    success: true,
    data: result,
    timestamp: new Date().toISOString(),
  });
});

export const handleRemoveFavorite = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireAuthenticatedUserId(req);
  const { id } = serviceIdParamSchema.parse(req.params);
  const result = await removeFavoriteService(userId, id);

  res.status(200).json({
    success: true,
    data: result,
    timestamp: new Date().toISOString(),
  });
});

export const handleListRecentServices = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireAuthenticatedUserId(req);
  const pagination = paginationQuerySchema.parse(req.query);
  const result = await listRecentlyExploredServices(userId, pagination);

  res.status(200).json({
    success: true,
    data: result,
    timestamp: new Date().toISOString(),
  });
});

export const handleRecordExploration = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireAuthenticatedUserId(req);
  const { id } = serviceIdParamSchema.parse(req.params);
  const result = await recordServiceExploration(userId, id);

  res.status(200).json({
    success: true,
    data: result,
    timestamp: new Date().toISOString(),
  });
});
