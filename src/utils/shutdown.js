// src/utils/shutdown.js
import { logger } from '../services/logger.js';

export function registerGracefulShutdown(stopFn) {
  let isShuttingDown = false;

  async function shutdown(signal) {
    if (isShuttingDown) {
      logger.info('Shutdown already in progress...');
      return;
    }

    isShuttingDown = true;
    logger.info(`${signal} received, shutting down gracefully...`);

    try {
      await stopFn();
      logger.info('Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown:', error);
      process.exit(1);
    }
  }

  // Handle graceful shutdown signals
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception:', error);
    shutdown('UNCAUGHT_EXCEPTION');
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled rejection at:', promise, 'reason:', reason);
    shutdown('UNHANDLED_REJECTION');
  });
}
