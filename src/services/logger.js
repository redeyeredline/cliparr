// Backend logging service using Pino for structured logging with environment-specific formatting.
// Provides JSON logging for production and pretty-printed logs for development with error serialization.
/* eslint-env node */
// src/services/logger.js
import pino from 'pino';
import fs from 'fs';

const isProd = process.env.NODE_ENV === 'production';

// Create logs directory if it doesn't exist
const logsDir = './logs';
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

export const appLogger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino/file',
    options: { destination: './logs/app.log', mkdir: true },
  },
});

export const workerLogger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino/file',
    options: { destination: './logs/worker.log', mkdir: true },
  },
});

export const websocketLogger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino/file',
    options: { destination: './logs/websocket.log', mkdir: true },
  },
});

export const dbLogger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino/file',
    options: { destination: './logs/db.log', mkdir: true },
  },
});
