import http from 'http';
import { logger } from '../services/logger.js';
import config from '../config/index.js';
import { createApp } from '../app.js';
import { setupWebSocket, getWebSocketServer } from '../services/websocket.js';
import { getDatabaseSingleton } from '../database/Auto_DB_Setup.js';
import { isPortInUse } from '../utils/isPortFree.js';
import { ImportTaskManager } from '../tasks/importTask.js';
import { registerGracefulShutdown } from '../utils/shutdown.js';
import { initializeQueues, startQueues, stopQueues } from '../services/queue.js';

let serverInstance, dbInstance, importTaskManager;

export async function startServer() {
  // Prevent double-start
  if (serverInstance?.listening) {
    logger.info('Server already running, skipping initialization');
    return serverInstance;
  }

  // --- 1) Verify Redis is running ---
  try {
    const Redis = (await import('ioredis')).default;
    const redis = new Redis({ host: 'localhost', port: 6379 });
    await redis.ping();
    await redis.quit();
    logger.info('✅ Redis connection verified');
  } catch (error) {
    logger.error('❌ Redis connection failed. Please ensure Redis is running: sudo systemctl start redis-server');
    throw new Error('Redis not available');
  }

  // --- 2) Tear down any old server/task instances ---
  if (importTaskManager) {
    await importTaskManager.stop();
    importTaskManager = null;
  }

  if (serverInstance) {
    try {
      serverInstance.close();
    } catch (err) {
      logger.error('Error closing old server:', err);
    }
    serverInstance = null;
  }

  // --- 3) Ensure the HTTP port is free ---
  if (await isPortInUse(config.port)) {
    throw new Error(`Port ${config.port} in use`);
  }

  try {
    // Initialize DB
    dbInstance = await getDatabaseSingleton(config.db.path);

    // Create Express app
    const app = createApp({ db: dbInstance, logger, wss: null });

    // HTTP & WebSocket
    serverInstance = http.createServer(app);
    setupWebSocket(serverInstance, config.ws);
    const wss = getWebSocketServer();
    app.set('wss', wss);

    // Import tasks
    importTaskManager = new ImportTaskManager(wss);
    app.set('importTaskManager', importTaskManager);
    await importTaskManager.start();

    // Job queue (BullMQ will connect to localhost:6379)
    await initializeQueues();
    await startQueues();
    logger.info('Job queue system initialized and started');

    // Start listening
    serverInstance.listen(config.port, config.host, () =>
      logger.info(`Listening on ${config.host}:${config.port}`),
    );

    // Graceful shutdown
    registerGracefulShutdown(async () => {
      logger.info('Starting graceful shutdown…');

      // Stop import tasks
      if (importTaskManager) {
        await importTaskManager.stop();
        importTaskManager = null;
      }

      // Stop queues
      await stopQueues();

      // Close WebSocket server
      if (wss) {
        await new Promise((r) => wss.close(r));
        logger.info('WebSocket server closed');
      }

      // Close HTTP server
      if (serverInstance?.listening) {
        await new Promise((r) => serverInstance.close(r));
        serverInstance = null;
        logger.info('HTTP server closed');
      }

      // Close DB
      if (dbInstance) {
        dbInstance.close();
        dbInstance = null;
        logger.info('Database connection closed');
      }

      logger.info('Cleanup completed');
    });

    return serverInstance;
  } catch (err) {
    logger.error('Failed to start server:', err);
    throw err;
  }
}
