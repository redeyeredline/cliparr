import pino from 'pino';

// Pino browser transport: logs to console
const logger = pino({
  browser: {
    asObject: true,
    write: (msg) => {
      // Use appropriate console method based on level
      switch (msg.level) {
        case 50:
          console.error('[ERROR]', msg.msg);
          break;
        case 40:
          console.warn('[WARN]', msg.msg);
          break;
        case 30:
          console.info('[INFO]', msg.msg);
          break;
        case 20:
          console.debug('[DEBUG]', msg.msg);
          break;
        default:
          console.log('[LOG]', msg.msg);
      }
    },
  },
  level: 'debug',
});

export { logger }; 