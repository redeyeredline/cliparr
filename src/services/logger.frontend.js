// Frontend logging service that provides consistent console output with log levels.
// Wraps console methods to provide structured logging interface for browser environment.
const logger = {
  info: (message, ...args) => {
    console.warn(`[INFO] ${message}`, ...args);
  },
  debug: (message, ...args) => {
    console.warn(`[DEBUG] ${message}`, ...args);
  },
  warn: (message, ...args) => {
    console.warn(`[WARN] ${message}`, ...args);
  },
  error: (message, ...args) => {
    console.error(`[ERROR] ${message}`, ...args);
  },
};

export { logger };
