import { Express } from 'express';
import { Server } from 'socket.io';
import { Logger } from 'pino';
import { getDatabase } from '../db/index.js';

export const setupRoutes = (app: Express, io: Server, logger: Logger): void => {
  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // WebSocket test endpoint
  app.get('/api/websocket-test', (req, res) => {
    res.json({ message: 'WebSocket test endpoint' });
  });

  // WebSocket connection handling
  io.on('connection', (socket) => {
    logger.info({ socketId: socket.id }, 'Client connected');

    socket.on('disconnect', () => {
      logger.info({ socketId: socket.id }, 'Client disconnected');
    });

    // Test event handler
    socket.on('test_event', (data) => {
      logger.debug({ data }, 'Received test event');
      socket.emit('test_response', { received: true, timestamp: new Date().toISOString() });
    });
  });

  // Error handling for undefined routes
  app.use((req, res) => {
    logger.warn({ url: req.url, method: req.method }, 'Route not found');
    res.status(404).json({ error: 'Not Found' });
  });
}; 