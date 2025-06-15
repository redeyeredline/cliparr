import http from 'http';
import { logger } from '../services/logger.js';
import config from '../config/index.js';
import { createApp } from '../app.js';
import { setupWebSocket, getWebSocketServer } from '../services/websocket.js';
import { getDatabaseSingleton } from '../database/Auto_DB_Setup.js';
import { isPortInUse } from '../utils/isPortFree.js';

let serverInstance, dbInstance;

export async function startServer() {
  if (serverInstance) {
    return serverInstance;
  }
  if (await isPortInUse(config.port)) {
    throw new Error(`Port ${config.port} in use`);
  }

  dbInstance = getDatabaseSingleton(config.db.path);
  const app = createApp({ db: dbInstance, logger, wss: null });

  serverInstance = http.createServer(app);
  setupWebSocket(serverInstance, config.ws);
  app.set('wss', getWebSocketServer());

  serverInstance.listen(config.port, config.host, () =>
    logger.info(`Listening on ${config.host}:${config.port}`),
  );
  return serverInstance;
}
