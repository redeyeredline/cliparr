/* eslint-env node */
// src/services/logger.js
import pino from 'pino';

const isProd = process.env.NODE_ENV === 'production';

export const logger = pino({
  level: process.env.LOG_LEVEL || (isProd ? 'info' : 'debug'),
  // in prod we emit raw JSON so log aggregators can parse it;
  // in dev we pretty-print for the console
  transport: isProd
    ? undefined
    : {
        target: 'pino-pretty',
        options: {
          colorize: true,
          levelFirst: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname'
        }
      },
  // automatically serialize Errors (so you get stack traces, etc.)
  serializers: {
    ...pino.stdSerializers,
    err: pino.stdSerializers.err
  },
  // redact any sensitive fields by default
  redact: {
    paths: ['req.headers.authorization', 'password'], 
    remove: true
  }
});
