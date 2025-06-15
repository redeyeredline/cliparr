// src/utils/shutdown.js
export function registerGracefulShutdown(stopFn) {
  async function shutdown(signal) {
    logger.info(`${signal} received, shutting down…`);
    await stopFn();
    process.exit(0);
  }
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}
