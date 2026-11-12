import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFoundHandler } from './middleware/notFoundHandler.js';
import { requestLogger } from './middleware/requestLogger.js';
import { architectureRouter } from './modules/architectures/architecture.routes.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { awsRouter } from './modules/aws/aws.routes.js';
import { dashboardRouter } from './modules/dashboard/dashboard.routes.js';
import { healthRouter } from './modules/health/health.routes.js';

export function createApp() {
  const app = express();
  const allowedOrigins = env.CORS_ORIGIN.split(',').map((origin) => origin.trim());

  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error(`Origin ${origin} is not allowed by CORS`));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use(requestLogger);

  app.get('/', (_req, res) => {
    res.status(200).json({
      success: true,
      data: {
        name: 'CloudForge API',
        phase: 'Phase 04 — AWS Architecture Builder',
        healthEndpoint: '/api/health',
      },
      timestamp: new Date().toISOString(),
    });
  });

  app.use('/api/health', healthRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/aws', awsRouter);
  app.use('/api/dashboard', dashboardRouter);
  app.use('/api/architectures', architectureRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
