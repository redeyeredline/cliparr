// Frontend logging service that provides consistent console output with log levels.
// Wraps console methods to provide structured logging interface for browser environment.
const logger = {
  info: () => {
    // No-op for info messages to reduce console noise
  },
  debug: () => {
    // No-op for debug messages to reduce console noise
  },
  warn: (message, ...args) => {
    console.warn(`[WARN] ${message}`, ...args);
  },
  error: (message, ...args) => {
    console.error(`[ERROR] ${message}`, ...args);
  },
};

export { logger };
