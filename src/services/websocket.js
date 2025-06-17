// src/services/websocket.js
import { WebSocketServer } from 'ws';
import { logger } from './logger.js';

let wsServer;

/**
 * Initialize and attach a WebSocketServer to an existing HTTP(S) server.
 * @param {import('http').Server} server  — the HTTP server instance
 * @param {object} [opts]
 * @param {string} [opts.path='/ws']   — the URL path for ws upgrades
 * @param {number} [opts.heartbeat=30000] — ping interval (ms)
 */
export function setupWebSocket(server, { path = '/ws', heartbeat = 30_000 } = {}) {
  wsServer = new WebSocketServer({ server, path });
  logger.info({ path }, 'WebSocketServer listening');

  wsServer.on('connection', (ws) => {
    logger.debug('WebSocket client connected');
    ws.isAlive = true;

    // heartbeat
    ws.on('pong', () => (ws.isAlive = true));

    ws.on('message', (raw) => {
      logger.debug({ raw }, 'WS message');
      // echo
      ws.send(JSON.stringify({
        type: 'echo',
        data: raw.toString(),
        timestamp: new Date().toISOString(),
      }));
    });

    ws.on('error', (err) => {
      logger.error({ err }, 'WebSocket error');
    });

    ws.on('close', () => {
      logger.debug('WebSocket disconnected');
    });

    // welcome payload
    ws.send(JSON.stringify({
      type: 'welcome',
      message: 'Connected to Cliparr backend',
      timestamp: new Date().toISOString(),
    }));
  });

  // ping‐pong to drop dead connections
  const interval = setInterval(() => {
    wsServer.clients.forEach((ws) => {
      if (!ws.isAlive) {
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, heartbeat);

  wsServer.on('close', () => clearInterval(interval));

  logger.info('WebSocket server initialized');
}

/** Get the running WebSocketServer instance */
export function getWebSocketServer() {
  return wsServer;
}
