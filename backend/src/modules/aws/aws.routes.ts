import { Router } from 'express';
import { optionalAuth, requireAuth } from '../../middleware/requireAuth.js';
import {
  handleAddFavorite,
  handleGetServiceBySlug,
  handleListCategories,
  handleListFavorites,
  handleListRecentServices,
  handleListServices,
  handleRecordExploration,
  handleRemoveFavorite,
  handleSearchServices,
} from './aws.controller.js';

export const awsRouter = Router();

// Catalog read routes support optional authentication to annotate user favorite status.
awsRouter.get('/categories', optionalAuth, handleListCategories);
awsRouter.get('/services', optionalAuth, handleListServices);
awsRouter.get('/services/search', optionalAuth, handleSearchServices);

// User-specific routes MUST precede /services/:slug and require authentication.
awsRouter.get('/services/favorites', requireAuth, handleListFavorites);
awsRouter.get('/services/recent', requireAuth, handleListRecentServices);
awsRouter.post('/services/:id/favorite', requireAuth, handleAddFavorite);
awsRouter.delete('/services/:id/favorite', requireAuth, handleRemoveFavorite);
awsRouter.post('/services/:id/explore', requireAuth, handleRecordExploration);

awsRouter.get('/services/:slug', optionalAuth, handleGetServiceBySlug);
