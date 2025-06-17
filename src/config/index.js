// src/config/index.js
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

const isProd = process.env.NODE_ENV === 'production';

const config = {
  env: process.env.NODE_ENV || 'development',
  host: process.env.HOST || '0.0.0.0',
  port: +(process.env.PORT || 8485),

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
    origin: isProd
      ? process.env.FRONTEND_URL || 'https://cliprr.example.com'
      : 'http://localhost:8484',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  },
};

// fail fast on critical ENV
if (!config.sonarr.apiKey) {
  throw new Error('Missing ENV var: SONARR_API_KEY');
}

export default config;
