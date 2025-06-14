import winston from 'winston';

// Create the logger instance
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
  ],
});

// Add performance logging
logger.on('data', (info) => {
  if (info.performance) {
    logger.info('Performance metric:', {
      operation: info.operation,
      duration: info.duration,
      timestamp: new Date().toISOString(),
    });
  }
}); 