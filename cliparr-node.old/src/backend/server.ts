import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import pino from 'pino';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import databaseRouter from './routes/database';
import { testConnection, initializeDatabase } from './config/database';
import sonarrRoutes from './routes/sonarr';
import dbTestRouter from './routes/dbTest';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.NODE_ENV === 'production' ? false : '*',
    methods: ['GET', 'POST'],
  },
});

const port = process.env.PORT || 8484;

const logger = pino({
  transport:
    process.env.NODE_ENV !== 'production'
      ? {
          target: 'pino-pretty',
          options: { colorize: true },
        }
      : undefined,
});

// WebSocket connection handling
io.on('connection', (socket: Socket) => {
  logger.info('Client connected:', socket.id);

  // Handle import progress updates
  socket.on('import:subscribe', () => {
    socket.join('import-updates');
  });

  // Handle audio analysis updates
  socket.on('analysis:subscribe', () => {
    socket.join('analysis-updates');
  });

  socket.on('disconnect', () => {
    logger.info('Client disconnected:', socket.id);
  });
});

// Export io instance for use in other modules
export const getIO = () => io;

// Middleware
logger.info('Registering middleware');
app.use(cors());
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());

// API routes
logger.info('Registering /api/health route');
app.get('/api/health', (req, res) => {
  logger.info('Health check endpoint hit');
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Register Sonarr routes
logger.info('Registering Sonarr routes');
app.use('/api/sonarr', sonarrRoutes);

// Register database routes
logger.info('Registering database routes');
app.use('/api/database', databaseRouter);

// Add routes
app.use('/api/db', dbTestRouter);

// Test DB connection at startup
testConnection()
  .then(isConnected => {
    if (isConnected) {
      logger.info('Database connection established');
    } else {
      logger.error('Database connection failed');
    }
  })
  .catch(err => {
    logger.error({ msg: 'Database connection failed', error: err.message });
  });

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  logger.info('Production mode: serving static frontend');
  const staticPath = path.join(__dirname, '../../dist/frontend');

  // Serve static files first
  app.use(express.static(staticPath));

  // Handle all non-API routes
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) {
      return next();
    }

    // For all other routes, serve the SPA
    logger.info('Serving frontend index.html for route:', req.path);
    res.sendFile(path.join(staticPath, 'index.html'));
  });
}

// Initialize DB before starting server
initializeDatabase()
  .then(() => {
    logger.info('Database initialized, starting server...');
    httpServer.listen(port, () => {
      logger.info(`Server running on port ${port}`);
    });
  })
  .catch(err => {
    logger.error({ msg: 'Failed to initialize database, server not started', error: err.message });
    process.exit(1);
  });
