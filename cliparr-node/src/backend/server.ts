import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import pino from 'pino';
import databaseRouter from './routes/database';
import { testConnection, initializeDatabase } from './config/database';
import sonarrRoutes from './routes/sonarr';

const app = express();
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

// Test DB connection at startup
testConnection()
  .then((isConnected) => {
    if (isConnected) {
      logger.info('Database connection established');
    } else {
      logger.error('Database connection failed');
    }
  })
  .catch((err) => {
    logger.error({ msg: 'Database connection failed', error: err.message });
  });

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  logger.info('Production mode: serving static frontend');
  app.use(express.static(path.join(__dirname, '../../dist/frontend')));

  app.get('*', (req, res) => {
    logger.info('Serving frontend index.html for unmatched route');
    res.sendFile(path.join(__dirname, '../../dist/frontend/index.html'));
  });
}

// Initialize DB before starting server
initializeDatabase()
  .then(() => {
    logger.info('Database initialized, starting server...');
    app.listen(port, () => {
      logger.info(`Server running on port ${port}`);
    });
  })
  .catch((err) => {
    logger.error({ msg: 'Failed to initialize database, server not started', error: err.message });
    process.exit(1);
  });
