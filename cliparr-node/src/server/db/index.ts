import Database from 'better-sqlite3';
import { Logger } from 'pino';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let db: Database.Database;

export const setupDatabase = async (logger: Logger): Promise<void> => {
  try {
    // Initialize database connection
    db = new Database(join(__dirname, '../../../data/cliparr.db'), {
      verbose: (message: unknown) => {
        if (typeof message === 'string') {
          logger.debug({ sql: message }, 'Executing SQL');
        }
      },
    });

    // Enable foreign keys
    db.pragma('foreign_keys = ON');

    // Create tables if they don't exist
    db.exec(`
      CREATE TABLE IF NOT EXISTS shows (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sonarr_id INTEGER UNIQUE NOT NULL,
        title TEXT NOT NULL,
        overview TEXT,
        status TEXT,
        network TEXT,
        imdb_id TEXT,
        tvdb_id INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS seasons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        show_id INTEGER NOT NULL,
        season_number INTEGER NOT NULL,
        title TEXT,
        overview TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (show_id) REFERENCES shows(id) ON DELETE CASCADE,
        UNIQUE(show_id, season_number)
      );

      CREATE TABLE IF NOT EXISTS episodes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        season_id INTEGER NOT NULL,
        sonarr_episode_id INTEGER UNIQUE NOT NULL,
        episode_number INTEGER NOT NULL,
        title TEXT NOT NULL,
        overview TEXT,
        air_date TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (season_id) REFERENCES seasons(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS episode_files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        episode_id INTEGER NOT NULL,
        path TEXT NOT NULL,
        size INTEGER,
        quality TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    logger.info('Database initialized successfully');
  } catch (error) {
    logger.error({ error }, 'Failed to initialize database');
    throw error;
  }
};

export const getDatabase = (): Database.Database => {
  if (!db) {
    throw new Error('Database not initialized');
  }
  return db;
}; 