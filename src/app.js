// Express application factory that sets up middleware, routes, and shared services.
// Configures CORS, JSON parsing, and mounts API route handlers for the backend.
// src/app.js
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import healthRoutes from './routes/health.js';
import showRoutes from './routes/shows.js';
import sonarrRoutes from './routes/sonarr.js';
import settingsRoutes from './routes/settings.js';
import hardwareRoutes from './routes/hardware.js';
import processingRoutes from './routes/processing.js';
import { initializeFingerprintSchema } from './services/fingerprintPipeline.js';
import { appLogger } from './services/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Assemble and return an Express application.
 *
 * @param {object} deps
 * @param {import('better-sqlite3').Database} deps.db
 * @param {import('pino').BaseLogger} deps.logger
 * @param {import('ws').WebSocketServer} deps.wss
 */
export function createApp({ db, logger: _logger = appLogger, wss }) {
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

  // CORS (allow all origins for internal/LAN use)
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    res.header('Access-Control-Allow-Credentials', 'true');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // mount API routes
  app.use('/health', healthRoutes);
  app.use('/shows', showRoutes);
  app.use('/sonarr', sonarrRoutes);
  app.use('/settings', settingsRoutes);
  app.use('/hardware', hardwareRoutes);
  app.use('/processing', processingRoutes);

  app.use((req, res, next) => {
    console.warn('INCOMING:', req.method, req.url, req.query);
    next();
  });

  // Serve static files from the React build
  const distPath = path.join(__dirname, '..', 'dist');
  app.use(express.static(distPath));

  // Handle client-side routing - serve index.html for all non-API routes
  app.use((req, res, next) => {
    // Skip API routes that actually exist
    if (
      req.path.startsWith('/health') ||
      req.path.startsWith('/shows') ||
      req.path.startsWith('/sonarr') ||
      req.path.startsWith('/settings') ||
      req.path.startsWith('/hardware') ||
      req.path.startsWith('/processing')
    ) {
      return next();
    }

    // For all other routes, serve index.html (client-side routing)
    // This handles page refreshes on client-side routes
    res.sendFile(path.join(distPath, 'index.html'), (err) => {
      if (err) {
        console.error('Error serving index.html:', err);
        res.status(500).json({ error: 'Internal server error' });
      }
    });
  });

  // Catch-all unmatched route logger (only for API routes that don't exist)
  app.use((req, res, _next) => {
    console.error('UNMATCHED API ROUTE:', req.method, req.url);
    res.status(404).json({ error: 'Not found' });
  });

  return app;
}
