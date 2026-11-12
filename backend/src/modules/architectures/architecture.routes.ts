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

export const architectureRouter = Router();

architectureRouter.use(requireAuth);

architectureRouter.get('/', handleListArchitectures);
architectureRouter.post('/', handleCreateArchitecture);
architectureRouter.get('/:id', handleGetArchitecture);
architectureRouter.patch('/:id', handleUpdateArchitecture);
architectureRouter.put('/:id/canvas', handleSaveArchitectureCanvas);
architectureRouter.post('/:id/duplicate', handleDuplicateArchitecture);
architectureRouter.delete('/:id', handleDeleteArchitecture);
