import pino from 'pino';

const transport = pino.transport({
  target: 'pino-pretty',
  options: {
    colorize: true,
    translateTime: 'SYS:standard',
    ignore: 'pid,hostname',
  },
});

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
}, transport);

// Create child loggers for different parts of the application
const createLogger = (name) => logger.child({ module: name });

export { logger, createLogger };
