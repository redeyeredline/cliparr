// Backend WebSocket server setup for real-time communication with frontend clients.
// Provides connection management, heartbeat monitoring, and message broadcasting capabilities.
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

  wsServer.on('connection', (ws) => {
    ws.isAlive = true;

    // heartbeat
    ws.on('pong', () => (ws.isAlive = true));

    ws.on('message', (raw) => {
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
      // Connection closed
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

  logger.info('✅ WebSocket initialized');
}

/** Get the running WebSocketServer instance */
export function getWebSocketServer() {
  return wsServer;
}

/**
 * Broadcast a message to all connected WebSocket clients
 * @param {object} message - The message to broadcast
 */
export function broadcastMessage(message) {
  if (!wsServer) {
    logger.warn('WebSocket server not initialized');
    return;
  }

  const payload = JSON.stringify({
    ...message,
    timestamp: new Date().toISOString(),
  });

  wsServer.clients.forEach((client) => {
    if (client.readyState === WebSocketServer.OPEN) {
      client.send(payload);
    }
  });
}

/**
 * Broadcast job queue updates to all connected clients
 * @param {object} update - The job update data
 */
export function broadcastJobUpdate(update) {
  broadcastMessage({
    type: 'job_update',
    ...update,
  });
}

/**
 * Broadcast processing status updates
 * @param {object} status - The processing status data
 */
export function broadcastProcessingStatus(status) {
  broadcastMessage({
    type: 'processing_status',
    ...status,
  });
}

/**
 * Broadcast queue status updates
 * @param {object} queueStatus - The queue status data
 */
export function broadcastQueueStatus(queueStatus) {
  broadcastMessage({
    type: 'queue_status',
    ...queueStatus,
  });
}
