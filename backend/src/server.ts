import { disconnectDatabase } from './config/database.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { createApp } from './app.js';

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(
    { port: env.PORT, environment: env.NODE_ENV, corsOrigin: env.CORS_ORIGIN },
    `CloudForge API server listening on http://localhost:${env.PORT}`,
  );
});

let isShuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info({ signal }, 'Received shutdown signal, closing server gracefully');

  server.close(async (closeErr) => {
    if (closeErr) {
      logger.error({ err: closeErr }, 'Error while closing HTTP server');
      process.exit(1);
    }

    try {
      await disconnectDatabase();
      logger.info('Database connections closed cleanly');
      process.exit(0);
    } catch (dbErr) {
      logger.error({ err: dbErr }, 'Failed to disconnect database cleanly');
      process.exit(1);
    }
  });
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
