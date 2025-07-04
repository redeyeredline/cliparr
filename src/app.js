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
import { initializeFingerprintSchema } from './services/fingerprintPipeline.js';
import { appLogger } from './services/logger.js';

/**
 * Assemble and return an Express application.
 *
 * @param {object} deps
 * @param {import('better-sqlite3').Database} deps.db
 * @param {import('pino').BaseLogger} deps.logger
 * @param {import('ws').WebSocketServer} deps.wss
 */
export function createApp({ db, logger = appLogger, wss }) {
  const app = express();

  // Initialize fingerprint schema
  initializeFingerprintSchema().catch((err) => {
    appLogger.error('Failed to initialize fingerprint schema:', err);
  });

  // make shared services available via app.get(...)
  app.set('db', db);
  app.set('logger', appLogger);
  app.set('wss', wss);

  // built-in middleware
  app.use(express.json());

  // CORS (uses config from src/config/index.js via your cors middleware)
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', 'http://localhost:8484');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    res.header('Access-Control-Allow-Credentials', 'true');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // mount routes
  app.use('/health', healthRoutes);
  app.use('/shows', showRoutes);
  app.use('/sonarr', sonarrRoutes);
  app.use('/settings', settingsRoutes);
  app.use('/hardware', hardwareRoutes);
  app.use('/processing', processingRoutes);

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
