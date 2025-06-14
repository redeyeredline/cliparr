import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import pino from 'pino';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { setupDatabase } from './db/index.js';
import { setupRoutes } from './api/routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize logger
const logger = pino({
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
    },
  },
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
});

// Create Express app
const app = express();
const httpServer = createServer(app);

// Initialize Socket.IO
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  logger.info({
    method: req.method,
    url: req.url,
    ip: req.ip,
  });
  next();
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error({
    error: err.message,
    stack: err.stack,
  });
  res.status(500).json({ error: 'Internal Server Error' });
});

// Setup database
await setupDatabase(logger);

// Setup API routes
setupRoutes(app, io, logger);

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(join(__dirname, '../../dist/client')));
  app.get('*', (req, res) => {
    res.sendFile(join(__dirname, '../../dist/client/index.html'));
  });
}

// Start server
const PORT = process.env.PORT || 8484;
httpServer.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
}); 