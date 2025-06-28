// Express application factory that sets up middleware, routes, and shared services.
// Configures CORS, JSON parsing, and mounts API route handlers for the backend.
// src/app.js
import express from 'express';
import cors from './middleware/cors.js';
import healthRoutes from './routes/health.js';
import showRoutes from './routes/shows.js';
import sonarrRoutes from './routes/sonarr.js';
import settingsRoutes from './routes/settings.js';
import hardwareRoutes from './routes/hardware.js';
import processingRoutes from './routes/processing.js';

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
  app.use('/hardware', hardwareRoutes);
  app.use('/api/processing', processingRoutes);

  app.use((req, res, next) => {
    console.log('INCOMING:', req.method, req.url, req.query);
    next();
  });

  // Catch-all unmatched route logger
  app.use((req, res, next) => {
    console.error('UNMATCHED ROUTE:', req.method, req.url);
    res.status(404).json({ error: 'Not found' });
  });

  return app;
}
