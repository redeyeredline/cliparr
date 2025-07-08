// Application configuration manager that loads environment variables and provides defaults.
// Centralizes server, database, WebSocket, and CORS settings for the backend application.
// src/config/index.js
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import os from 'os';
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isProd = process.env.NODE_ENV === 'production';

const tempDir = process.env.CLIPRR_TEMP_DIR || path.join(os.tmpdir(), 'cliprr');
try {
  // Try to load from settings if available (synchronously)
  // This is a fallback; main usage should be via settings API or DB
  // (You may want to refactor to always use the DB value at runtime)
  // For now, this ensures config.tempDir is always defined
} catch (e) {}

const config = {
  env: process.env.NODE_ENV || 'development',
  host: process.env.HOST || '0.0.0.0',
  port: +(process.env.PORT || 8484),

  // Sonarr
  sonarr: {
    apiKey: process.env.SONARR_API_KEY,
    url: process.env.SONARR_URL || 'http://localhost:8989',
  },

  // Database
  db: {
    path: process.env.DB_PATH
      || path.join(__dirname, '..', 'database', 'data', 'cliparr.db'),
  },

  // WebSocket
  ws: {
    path: process.env.WS_PATH || '/ws',
    heartbeat: +(process.env.WS_PING_MS || 30000),
  },

  // CORS (used in your cors middleware)
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  },

  tempDir,
};

export default config;
