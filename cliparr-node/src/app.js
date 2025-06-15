// src/app.js
import express from 'express';
import cors from './middleware/cors.js';
import healthRoutes from './routes/health.js';
import showRoutes from './routes/shows.js';
import sonarrRoutes from './routes/sonarr.js';
import settingsRoutes from './routes/settings.js';

/**
 * Assemble and return an Express application.
 *
 * @param {object} deps
 * @param {import('better-sqlite3').Database} deps.db
 * @param {import('pino').BaseLogger} deps.logger
 * @param {import('ws').WebSocketServer} deps.wss
 */
export function createApp({ db, logger, wss }) {
  const app = express();

  // make shared services available via app.get(...)
  app.set('db', db);
  app.set('logger', logger);
  app.set('wss', wss);

  // built-in middleware
  app.use(express.json());

  // CORS (uses config from src/config/index.js via your cors middleware)
  app.use(cors);

  // mount routes
  app.use('/health', healthRoutes);
  app.use('/shows', showRoutes);
  app.use('/sonarr', sonarrRoutes);
  app.use('/settings', settingsRoutes);

  return app;
}
