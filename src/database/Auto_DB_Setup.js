// Database singleton manager that initializes SQLite connection and creates schema.
// Handles database setup, default settings insertion, and connection lifecycle management.
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { dbLogger } from '../services/logger.js';
import { STATEMENTS } from './Schema.mjs';

let dbInstance = null;

export async function getDatabaseSingleton(dbPath) {
  if (dbInstance) {
    return dbInstance;
  }

  try {
    // Ensure absolute path
    const absoluteDbPath = path.isAbsolute(dbPath) ? dbPath : path.resolve(process.cwd(), dbPath);
    const dbDir = path.dirname(absoluteDbPath);

    // Create database directory if it doesn't exist (non-blocking)
    try {
      await fs.promises.stat(dbDir);
    } catch (error) {
      if (error.code === 'ENOENT') {
        // Create the directory if it doesn't exist
        await fs.promises.mkdir(dbDir, { recursive: true });
        // dbLogger.info({ dbDir }, 'Creating database directory');
      } else {
        throw error;
      }
    }

    // Create database connection
    // dbLogger.info({ dbPath: absoluteDbPath }, 'Opening database connection');
    dbInstance = new Database(absoluteDbPath);

    // Batch PRAGMA settings
    ['journal_mode = WAL', 'busy_timeout = 5000'].forEach((setting) => dbInstance.pragma(setting));

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
          { key: 'cpu_worker_limit', value: '2' },
          { key: 'gpu_worker_limit', value: '1' },
        ];

        const insertStmt = dbInstance.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');

        for (const setting of defaultSettings) {
          insertStmt.run(setting.key, setting.value);
        }
      }
    });

    init();
    dbLogger.info('✅ Database started');
    return dbInstance;
  } catch (err) {
    console.error('❌ Database failed to start:', err);
    if (dbInstance) {
      try {
        dbInstance.close();
      } catch (closeErr) {
        console.error('Error closing database after initialization failure:', closeErr);
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
    dbLogger.info('Database connection closed');
  } catch (err) {
    dbLogger.error({ err }, 'Error closing database connection');
    throw err;
  }
}
