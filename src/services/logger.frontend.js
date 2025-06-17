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
