// src/integration/server.js
import express from 'express';
import http from 'http';
import { logger } from '../services/logger.js';
import cors from '../middleware/cors.js';
import config from '../config/index.js';
import { setupWebSocket, getWebSocketServer } from '../services/websocket.js';
import { getDatabaseSingleton } from '../database/Auto_DB_Setup.js';
import healthRoutes from '../routes/health.js';
import showRoutes from '../routes/shows.js';
import sonarrRoutes from '../routes/sonarr.js';
import settingsRoutes from '../routes/settings.js';

let serverInstance = null;
let dbInstance = null;

/** Returns true if something is already listening on the given port */
async function isPortInUse(port) {
  return new Promise((resolve) => {
    const tester = http.createServer();
    tester.once('error', () => resolve(true));
    tester.once('listening', () => tester.close(() => resolve(false)));
    tester.listen(port);
  });
}

export async function startServer() {
  if (serverInstance) {
    logger.warn('Server already running');
    return serverInstance;
  }

  const { host, port, db, ws } = config;

  // ensure port is free
  if (await isPortInUse(port)) {
    const msg = `Port ${port} is already in use`;
    logger.error(msg);
    throw new Error(msg);
  }

  logger.info(`Starting server on ${host}:${port} in ${config.env} mode`);

  // init DB
  dbInstance = getDatabaseSingleton(db.path);

  // express app
  const app = express();
  app.set('db', dbInstance);
  app.set('logger', logger);

  // middleware
  app.use(express.json());
  app.use(cors);

  // routes
  app.use('/health', healthRoutes);
  app.use('/shows', showRoutes);
  app.use('/sonarr', sonarrRoutes);
  app.use('/settings', settingsRoutes);

  // HTTP + WS
  const server = http.createServer(app);
  setupWebSocket(server, { path: ws.path, heartbeat: ws.heartbeat });
  app.set('wss', getWebSocketServer());

  server.listen(port, host, () => {
    serverInstance = server;
    logger.info(`Server listening at http://${host}:${port}`);
  });

  server.on('error', (error) => {
    logger.error({ error }, 'Server error');
    stopServer();
  });

  return serverInstance;
}

export async function stopServer() {
  if (!serverInstance) {
    return;
  }
  // close WebSocket first
  const wss = getWebSocketServer();
  if (wss) {
    wss.close(() => logger.info('WebSocket server closed'));
  }
  // then HTTP
  await new Promise((res) => serverInstance.close(res));
  logger.info('HTTP server closed');
  dbInstance = null;
  serverInstance = null;
}

// handle termination signals
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received—shutting down');
  await stopServer();
  process.exit(0);
});
process.on('SIGINT', async () => {
  logger.info('SIGINT received—shutting down');
  await stopServer();
  process.exit(0);
});

// allow `node src/integration/server.js` to start directly
if (process.argv[1].endsWith('server.js')) {
  startServer().catch((err) => {
    logger.fatal({ err }, 'Failed to start server');
    process.exit(1);
  });
}
