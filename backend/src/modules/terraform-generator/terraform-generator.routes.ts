import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth.js';
import { handleGenerateTerraform } from './terraform-generator.controller.js';

export const terraformRouter = Router();

terraformRouter.use(requireAuth);

terraformRouter.post('/architectures/:id/terraform', handleGenerateTerraform);
