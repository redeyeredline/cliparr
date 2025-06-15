// src/services/logger.js
import pino from 'pino';

export const logger = pino({
  level: 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      levelFirst: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname'
    }
  }
});
