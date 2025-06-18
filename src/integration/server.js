import http from 'http';
import { logger } from '../services/logger.js';
import config from '../config/index.js';
import { createApp } from '../app.js';
import { setupWebSocket, getWebSocketServer } from '../services/websocket.js';
import { getDatabaseSingleton } from '../database/Auto_DB_Setup.js';
import { isPortInUse } from '../utils/isPortFree.js';
import { ImportTaskManager } from '../tasks/importTask.js';
import { registerGracefulShutdown } from '../utils/shutdown.js';

let serverInstance, dbInstance, importTaskManager;

export async function startServer() {
  // If server is already running, don't start another one
  if (serverInstance?.listening) {
    logger.info('Server already running, skipping initialization');
    return serverInstance;
  }

  // Clean up any existing instances
  if (importTaskManager) {
    importTaskManager.stop();
    importTaskManager = null;
  }

  if (serverInstance) {
    try {
      serverInstance.close();
    } catch (err) {
      logger.error('Error closing existing server:', err);
    }
    serverInstance = null;
  }

  // Check if port is available
  if (await isPortInUse(config.port)) {
    throw new Error(`Port ${config.port} in use`);
  }

  try {
    dbInstance = getDatabaseSingleton(config.db.path);
    const app = createApp({ db: dbInstance, logger, wss: null });

    serverInstance = http.createServer(app);
    setupWebSocket(serverInstance, config.ws);
    const wss = getWebSocketServer();
    app.set('wss', wss);

    // Initialize and start the import task manager
    importTaskManager = new ImportTaskManager(wss);
    importTaskManager.start();

    serverInstance.listen(config.port, config.host, () =>
      logger.info(`Listening on ${config.host}:${config.port}`),
    );

    // Register graceful shutdown handler
    registerGracefulShutdown(async () => {
      logger.info('Starting graceful shutdown...');
      
      // Stop the import task first
      if (importTaskManager) {
        await importTaskManager.stop();
        importTaskManager = null;
      }

      // Close WebSocket connections
      if (wss) {
        await new Promise((resolve) => {
          wss.close(() => {
            logger.info('WebSocket server closed');
            resolve();
          });
        });
      }

      // Close HTTP server
      if (serverInstance?.listening) {
        await new Promise((resolve) => {
          serverInstance.close(() => {
            logger.info('HTTP server closed');
            resolve();
          });
        });
        serverInstance = null;
      }

      // Close database connection
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
