import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import pino from 'pino';
import { WebSocketServer } from 'ws';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize logger
const logger = pino({
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true
    }
  }
});

const app = express();
const port = process.env.PORT || 8484;

// Initialize WebSocket server
const wss = new WebSocketServer({ noServer: true });

// Initialize database
const db = new Database('/data/cliparr.db', { verbose: logger.info });

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../../dist')));

// Basic health check endpoint
app.get('/api/health', (req, res) => {
  logger.info('Health check requested');
  res.json({ status: 'healthy' });
});

// WebSocket connection handler
wss.on('connection', (ws) => {
  logger.info('New WebSocket connection');
  
  ws.on('message', (message) => {
    logger.info('Received message:', message.toString());
  });

  ws.on('error', (error) => {
    logger.error('WebSocket error:', error);
  });
});

// Start server
const server = app.listen(port, () => {
  logger.info(`Server running on port ${port}`);
});

// Handle WebSocket upgrade
server.on('upgrade', (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});

// Handle server errors
server.on('error', (error) => {
  logger.error('Server error:', error);
}); 