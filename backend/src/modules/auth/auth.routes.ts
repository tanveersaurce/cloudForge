import { Router } from 'express';
import { authRateLimiter } from '../../middleware/rateLimiters.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import {
  handleGetMe,
  handleLogin,
  handleLogout,
  handleRefresh,
  handleRegister,
} from './auth.controller.js';

export const authRouter = Router();

authRouter.post('/register', authRateLimiter, handleRegister);
authRouter.post('/login', authRateLimiter, handleLogin);
authRouter.post('/refresh', handleRefresh);
authRouter.post('/logout', handleLogout);
authRouter.get('/me', requireAuth, handleGetMe);
