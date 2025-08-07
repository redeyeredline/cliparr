import http from 'http';
import { appLogger } from '../services/logger.js';
import config from '../config/index.js';
import { createApp } from '../app.js';
import { setupWebSocket, getWebSocketServer } from '../services/websocket.js';
import { getDatabaseSingleton } from '../database/Auto_DB_Setup.js';
import { isPortInUse } from '../utils/isPortFree.js';
import { ImportTaskManager } from '../tasks/importTask.js';
import { registerGracefulShutdown } from '../utils/shutdown.js';
import { initializeQueues, startQueues, stopQueues, recoverInterruptedJobs, checkAndCleanupStaleJobs, synchronizeJobStates, startPeriodicJobRecovery, stopPeriodicJobRecovery } from '../services/queue.js';

let serverInstance, dbInstance, importTaskManager;

export async function startServer() {
  console.log('🚀 Starting server initialization...');

  // Prevent double-start
  if (serverInstance?.listening) {
    appLogger.info('Server already running, skipping initialization');
    return serverInstance;
  }

  // --- 1) Verify Redis is running ---
  console.log('🔍 Checking Redis connection...');
  try {
    const Redis = (await import('ioredis')).default;
    const redis = new Redis({ host: 'localhost', port: 6379 });
    await redis.ping();
    await redis.quit();
    appLogger.info('✅ Redis connection verified');
    console.log('✅ Redis connection verified');
  } catch (error) {
    appLogger.error(
      '❌ Redis connection failed. Please ensure Redis is running: sudo systemctl start redis-server',
    );
    console.error('❌ Redis connection failed:', error.message);
    throw new Error('Redis not available');
  }

  // --- 2) Tear down any old server/task instances ---
  console.log('🧹 Cleaning up old instances...');
  if (importTaskManager) {
    await importTaskManager.stop();
    importTaskManager = null;
  }

  if (serverInstance) {
    try {
      serverInstance.close();
    } catch (err) {
      appLogger.error('Error closing old server:', err);
    }
    serverInstance = null;
  }

  // --- 3) Ensure the HTTP port is free ---
  console.log(`🔍 Checking if port ${config.port} is available...`);
  if (await isPortInUse(config.port)) {
    throw new Error(`Port ${config.port} in use`);
  }
  console.log(`✅ Port ${config.port} is available`);

  try {
    // Initialize DB
    console.log('🗄️ Initializing database...');
    dbInstance = await getDatabaseSingleton(config.db.path);
    console.log('✅ Database initialized');

    // Create Express app
    console.log('🌐 Creating Express app...');
    const app = createApp({ db: dbInstance, logger: appLogger, wss: null });
    console.log('✅ Express app created');

    // HTTP & WebSocket
    console.log('🔌 Setting up HTTP server and WebSocket...');
    serverInstance = http.createServer(app);
    setupWebSocket(serverInstance, config.ws);
    const wss = getWebSocketServer();
    app.set('wss', wss);
    console.log('✅ HTTP server and WebSocket setup complete');

    // Import tasks
    console.log('📋 Initializing import task manager...');
    importTaskManager = new ImportTaskManager(wss);
    app.set('importTaskManager', importTaskManager);
    await importTaskManager.start();
    console.log('✅ Import task manager started');

    // Job queue (BullMQ will connect to localhost:6379)
    console.log('🔄 Initializing job queues...');
    await initializeQueues();
    await startQueues();
    appLogger.info('Job queue system initialized and started');
    console.log('✅ Job queues initialized and started');

    // Recover interrupted jobs from previous runs
    console.log('🔄 Recovering interrupted jobs...');
    await checkAndCleanupStaleJobs();
    await synchronizeJobStates();
    await recoverInterruptedJobs();
    appLogger.info('Job recovery process completed');
    console.log('✅ Job recovery process completed');

    // Start periodic job recovery
    console.log('🔄 Starting periodic job recovery...');
    await startPeriodicJobRecovery();
    appLogger.info('Periodic job recovery started');
    console.log('✅ Periodic job recovery started');

    // Start listening
    console.log(`🎧 Starting to listen on ${config.host}:${config.port}...`);
    serverInstance.listen(config.port, config.host, () => {
      appLogger.info(`Listening on ${config.host}:${config.port}`);
      console.log(`🎉 Server is now listening on ${config.host}:${config.port}`);
    });

    // Graceful shutdown
    registerGracefulShutdown(async () => {
      appLogger.info('Starting graceful shutdown…');

      // Stop import tasks
      if (importTaskManager) {
        await importTaskManager.stop();
        importTaskManager = null;
      }

      // Stop periodic job recovery
      await stopPeriodicJobRecovery();

      // Stop queues
      await stopQueues();

      // Close WebSocket server
      if (wss) {
        await new Promise((r) => wss.close(r));
        appLogger.info('WebSocket server closed');
      }

      // Close HTTP server
      if (serverInstance?.listening) {
        await new Promise((r) => serverInstance.close(r));
        serverInstance = null;
        appLogger.info('HTTP server closed');
      }

      // Close DB
      if (dbInstance) {
        dbInstance.close();
        dbInstance = null;
        appLogger.info('Database connection closed');
      }

      appLogger.info('Cleanup completed');
    });

    return serverInstance;
  } catch (err) {
    appLogger.error('Failed to start server:', err);
    console.error('❌ Failed to start server:', err);
    throw err;
  }
}

// Start the server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startServer().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}
