import winston from 'winston';

// Custom format for better readability
const customFormat = winston.format.printf(({ level, message, timestamp, ...metadata }) => {
  let msg = `${timestamp} [${level}]: ${message}`;

  // Add metadata if present
  if (Object.keys(metadata).length > 0) {
    msg += ` ${JSON.stringify(metadata, null, 2)}`;
  }

  return msg;
});

// Create the logger instance
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'cliparr-backend' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        customFormat
      ),
    }),
  ],
});

// Add performance logging
logger.on('data', info => {
  if (info.performance) {
    logger.info('Performance metric:', {
      operation: info.operation,
      duration: `${info.duration}ms`,
      timestamp: new Date().toISOString(),
    });
  }
});

// Add error logging with stack traces
logger.on('error', error => {
  logger.error('Unhandled error:', {
    error: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString(),
  });
});

// Export a function to create child loggers
export const createChildLogger = (context: string) => {
  return logger.child({ context });
};
