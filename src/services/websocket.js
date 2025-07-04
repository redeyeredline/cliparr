// Backend WebSocket server setup for real-time communication with frontend clients.
// Provides connection management, heartbeat monitoring, and message broadcasting capabilities.
// src/services/websocket.js
import { WebSocketServer } from 'ws';
import { websocketLogger } from './logger.js';
import fs from 'fs';

let wsServer;
const wsLogStream = fs.createWriteStream('websocket.log', { flags: 'a' });
let messageQueue = [];

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
    websocketLogger.info('WebSocket client connected');
    ws.isAlive = true;

    // Flush any queued messages
    if (messageQueue.length > 0) {
      websocketLogger.info({ count: messageQueue.length }, 'Flushing queued messages to new client');
      messageQueue.forEach((payload) => {
        ws.send(payload);
      });
      messageQueue = [];
    }

    // heartbeat
    ws.on('pong', () => (ws.isAlive = true));

    ws.on('message', (raw) => {
      ws.send(JSON.stringify({
        type: 'echo',
        data: raw.toString(),
        timestamp: new Date().toISOString(),
      }));
    });

    ws.on('error', (err) => {
      websocketLogger.error({ err }, 'WebSocket error');
    });

    ws.on('close', () => {
      websocketLogger.info('WebSocket client disconnected');
    });

    ws.send(JSON.stringify({
      type: 'welcome',
      message: 'Connected to Cliparr backend',
      timestamp: new Date().toISOString(),
    }));

    setTimeout(() => {
      websocketLogger.info({ clientCount: wsServer.clients.size }, 'Clients after welcome');
      wsServer.clients.forEach((client) => {
        websocketLogger.info({
          clientReadyState: client.readyState,
          isOpen: client.readyState === 1,
        }, 'Client state after welcome');
      });
    }, 1000);

    setTimeout(() => {
      ws.send(JSON.stringify({ type: 'test_broadcast', message: 'This is a test broadcast from backend' }));
    }, 2000);
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

  websocketLogger.info('✅ WebSocket initialized');
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
    websocketLogger.warn('WebSocket server not initialized');
    return;
  }

  const payload = JSON.stringify({
    ...message,
    timestamp: new Date().toISOString(),
  });

  // Write to websocket.log
  wsLogStream.write(`[WebSocket OUT] ${payload}\n`);

  websocketLogger.info({ clientCount: wsServer.clients.size, payload }, 'Broadcasting message to clients');

  let sent = false;
  wsServer.clients.forEach((client) => {
    websocketLogger.info({
      clientReadyState: client.readyState,
      isOpen: client.readyState === 1,
    }, 'Client state during broadcast');
    if (client.readyState === 1) {
      client.send(payload);
      sent = true;
    }
  });
  if (!sent) {
    websocketLogger.warn('No open clients during broadcast, queuing message');
    messageQueue.push(payload);
  }
}

/**
 * Broadcast job queue updates to all connected clients
 * @param {object} update - The job update data
 */
export function broadcastJobUpdate(update) {
  broadcastMessage(update);
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
