import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth.js';
import { handleGetDashboardOverview } from './dashboard.controller.js';

export const dashboardRouter = Router();

dashboardRouter.use(requireAuth);
dashboardRouter.get('/overview', handleGetDashboardOverview);
