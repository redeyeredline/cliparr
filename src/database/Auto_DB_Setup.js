import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { logger } from '../services/logger.js';
import { STATEMENTS } from './Schema.mjs';

let dbInstance = null;

export async function getDatabaseSingleton(dbPath) {
  if (dbInstance) {
    logger.debug('Returning existing database instance');
    return dbInstance;
  }

  try {
    logger.info('Creating new database instance...');
    // Ensure absolute path
    const absoluteDbPath = path.isAbsolute(dbPath) ? dbPath : path.resolve(process.cwd(), dbPath);
    const dbDir = path.dirname(absoluteDbPath);

    // Create database directory if it doesn't exist (non-blocking)
    try {
      await fs.promises.stat(dbDir);
    } catch (error) {
      if (error.code === 'ENOENT') {
        logger.info({ dbDir }, 'Creating database directory');
        await fs.promises.mkdir(dbDir, { recursive: true });
      } else {
        throw error;
      }
    }

    // Create database connection
    logger.info({ dbPath: absoluteDbPath }, 'Opening database connection');
    dbInstance = new Database(absoluteDbPath);

    // Batch PRAGMA settings
    ['journal_mode = WAL', 'busy_timeout = 5000']
      .forEach((setting) => dbInstance.pragma(setting));

    // Create schema inside a single transaction
    const init = dbInstance.transaction(() => {
      // Create tables if they don't exist
      for (const stmt of STATEMENTS) {
        dbInstance.exec(stmt);
      }

      // Check if settings table is empty
      const settingsCount = dbInstance
        .prepare('SELECT COUNT(*) as count FROM settings')
        .get().count;

      // Only set defaults if settings table is empty
      if (settingsCount === 0) {
        const defaultSettings = [
          { key: 'import_mode', value: 'none' },
          { key: 'polling_interval', value: '900' },
        ];

        const insertStmt = dbInstance.prepare(
          'INSERT INTO settings (key, value) VALUES (?, ?)',
        );

        for (const setting of defaultSettings) {
          insertStmt.run(setting.key, setting.value);
        }
      }
    });

    init();
    logger.info({ dbPath: absoluteDbPath }, 'Database initialized successfully');
    return dbInstance;

  } catch (err) {
    logger.error({ err, dbPath }, 'Database initialization failed');
    if (dbInstance) {
      try {
        dbInstance.close();
      } catch (closeErr) {
        logger.error({ err: closeErr }, 'Error closing database after initialization failure');
      }
      dbInstance = null;
    }
    throw err;
  }
}

export function closeDatabase() {
  if (!dbInstance) {
    return;
  }
  try {
    dbInstance.close();
    dbInstance = null;
    logger.info('Database connection closed');
  } catch (err) {
    logger.error({ err }, 'Error closing database connection');
    throw err;
  }
}
