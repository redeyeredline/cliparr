import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import pino from 'pino';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

// Function to drop all tables
function dropAllTables(db) {
  logger.info('Dropping all existing tables');
  db.exec(`
    DROP TABLE IF EXISTS episode_files;
    DROP TABLE IF EXISTS episodes;
    DROP TABLE IF EXISTS seasons;
    DROP TABLE IF EXISTS shows;
    DROP TABLE IF EXISTS settings;
  `);
}

// Function to create all tables
function createTables(db) {
  logger.info('Creating database tables');
  db.exec(`
    CREATE TABLE IF NOT EXISTS shows (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sonarr_id INTEGER UNIQUE NOT NULL,
      title TEXT NOT NULL,
      overview TEXT,
      path TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS seasons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      show_id INTEGER NOT NULL,
      season_number INTEGER NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (show_id) REFERENCES shows(id),
      UNIQUE(show_id, season_number)
    );

    CREATE TABLE IF NOT EXISTS episodes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      season_id INTEGER NOT NULL,
      episode_number INTEGER NOT NULL,
      title TEXT NOT NULL,
      sonarr_episode_id INTEGER UNIQUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (season_id) REFERENCES episodes(id),
      UNIQUE(season_id, episode_number)
    );

    CREATE TABLE IF NOT EXISTS episode_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      episode_id INTEGER NOT NULL,
      file_path TEXT NOT NULL,
      size INTEGER,
      quality TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (episode_id) REFERENCES episodes(id)
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  // Create indexes for better query performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_shows_title ON shows(title COLLATE NOCASE);
    CREATE INDEX IF NOT EXISTS idx_shows_sonarr_id ON shows(sonarr_id);
    CREATE INDEX IF NOT EXISTS idx_seasons_show_id ON seasons(show_id);
    CREATE INDEX IF NOT EXISTS idx_episodes_season_id ON episodes(season_id);
    CREATE INDEX IF NOT EXISTS idx_episodes_sonarr_episode_id ON episodes(sonarr_episode_id);
  `);
}

export function getDatabaseSingleton(dbPath) {
  if (dbInstance) {
    return dbInstance;
  }

  try {
    logger.info(`Initializing database at ${dbPath}`);
    dbInstance = new Database(dbPath);
    
    // Enable WAL mode for better concurrency
    dbInstance.pragma('journal_mode = WAL');
    
    // Set busy timeout to handle concurrent access
    dbInstance.pragma('busy_timeout = 5000');

    // Drop and recreate tables to ensure schema is up to date
    dropAllTables(dbInstance);
    createTables(dbInstance);

    logger.info('Database initialized successfully');
    return dbInstance;
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to initialize database');
    throw error;
  }
}

export function closeDatabase() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
    logger.info('Database connection closed');
  }
}