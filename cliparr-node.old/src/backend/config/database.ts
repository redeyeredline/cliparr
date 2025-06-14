import Database from 'better-sqlite3';
import { logger } from '../utils/logger';

// Database file path
const DB_PATH = process.env.DB_PATH || '/opt/dockerdata/cliparr/cliparr.db';

// Define types for database results
interface SettingsRow {
  value: string;
}

// Initialize database connection
let db: Database.Database;

const initializeDatabase = async () => {
  try {
    // Open database connection
    db = new Database(DB_PATH, { verbose: logger.debug });

    // Enable foreign keys
    db.pragma('foreign_keys = ON');

    // Create tables
    db.exec(`
      CREATE TABLE IF NOT EXISTS shows (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sonarr_id INTEGER UNIQUE NOT NULL,
        title TEXT NOT NULL,
        path TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_shows_sonarr_id ON shows(sonarr_id);
      CREATE INDEX IF NOT EXISTS idx_shows_status ON shows(status);

      CREATE TABLE IF NOT EXISTS episodes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        show_id INTEGER NOT NULL,
        sonarr_id INTEGER UNIQUE NOT NULL,
        season_number INTEGER NOT NULL,
        episode_number INTEGER NOT NULL,
        title TEXT NOT NULL,
        path TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (show_id) REFERENCES shows(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_episodes_show_id ON episodes(show_id);
      CREATE INDEX IF NOT EXISTS idx_episodes_sonarr_id ON episodes(sonarr_id);
      CREATE INDEX IF NOT EXISTS idx_episodes_season_episode ON episodes(season_number, episode_number);

      CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT UNIQUE NOT NULL,
        value TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key);
    `);

    logger.info('Database tables initialized successfully');
    return true;
  } catch (error) {
    logger.error('Failed to initialize database:', error);
    throw error;
  }
};

// Test database connection
const testConnection = async () => {
  try {
    db.prepare('SELECT 1').get();
    logger.info('Successfully connected to SQLite database');
    return true;
  } catch (error) {
    logger.error('Failed to connect to SQLite database:', error);
    return false;
  }
};

// Verify database operations
const verifyDatabaseOperations = async () => {
  try {
    // Test write
    const stmt = db.prepare(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?'
    );
    const timestamp = new Date().toISOString();
    stmt.run('test_key', timestamp, timestamp);

    // Test read
    const result = db.prepare('SELECT value FROM settings WHERE key = ?').get('test_key') as
      | SettingsRow
      | undefined;

    return {
      success: true,
      timestamp: result?.value,
    };
  } catch (error) {
    logger.error('Database verification error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

export { db, testConnection, initializeDatabase, verifyDatabaseOperations };
