import { Router } from 'express';
import { handleGetHealth, handleGetLiveness } from './health.controller.js';

export const healthRouter = Router();

healthRouter.get('/', handleGetHealth);
healthRouter.get('/live', handleGetLiveness);
