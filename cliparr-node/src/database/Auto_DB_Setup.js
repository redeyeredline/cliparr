import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import pino from 'pino';
import { STATEMENTS } from './Schema.mjs';

// Initialize logger
const logger = pino({
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

let dbInstance = null;

export function getDatabaseSingleton(dbPath) {
  if (dbInstance) return dbInstance;

  logger.info({ dbPath }, 'Initializing database');
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  dbInstance = new Database(dbPath);

  // Batch PRAGMA settings
  ['journal_mode = WAL', 'busy_timeout = 5000']
    .forEach(setting => dbInstance.pragma(setting));

  // Create schema inside a single transaction
  try {
    const init = dbInstance.transaction(() => {
      for (const stmt of STATEMENTS) {
        dbInstance.exec(stmt);
      }
      dbInstance.exec(
        `INSERT OR IGNORE INTO settings (key, value) VALUES ('import_mode', 'none');`
      );
    });
    init();
  } catch (err) {
    logger.error({ err }, 'Schema initialization failed');
    throw err;
  }

  logger.info({ dbPath }, 'Database initialized successfully');
  return dbInstance;
}

export function closeDatabase() {
  if (!dbInstance) return;
  dbInstance.close();
  dbInstance = null;
  logger.info('Database connection closed');
}
