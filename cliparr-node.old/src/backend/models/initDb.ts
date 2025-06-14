import pino from 'pino';
import pool from './db';
import { db } from '../config/database';
import { logger } from '../utils/logger';

const loggerPg = pino({
  transport:
    process.env.NODE_ENV !== 'production'
      ? {
          target: 'pino-pretty',
          options: { colorize: true },
        }
      : undefined,
});

export async function initializeDatabase(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Create shows table
    await client.query(`
      CREATE TABLE IF NOT EXISTS shows (
        id SERIAL PRIMARY KEY,
        sonarr_id INTEGER UNIQUE NOT NULL,
        title TEXT NOT NULL,
        overview TEXT,
        path TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create seasons table
    await client.query(`
      CREATE TABLE IF NOT EXISTS seasons (
        id SERIAL PRIMARY KEY,
        show_id INTEGER REFERENCES shows(id) ON DELETE CASCADE,
        season_number INTEGER NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(show_id, season_number)
      )
    `);

    // Create episodes table
    await client.query(`
      CREATE TABLE IF NOT EXISTS episodes (
        id SERIAL PRIMARY KEY,
        season_id INTEGER REFERENCES seasons(id) ON DELETE CASCADE,
        episode_number INTEGER NOT NULL,
        title TEXT,
        sonarr_episode_id INTEGER UNIQUE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create episode_files table
    await client.query(`
      CREATE TABLE IF NOT EXISTS episode_files (
        id SERIAL PRIMARY KEY,
        episode_id INTEGER REFERENCES episodes(id) ON DELETE CASCADE,
        file_path TEXT NOT NULL,
        size BIGINT,
        quality TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(episode_id)
      )
    `);

    // Create settings table
    await client.query(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes for better query performance
    await client.query('CREATE INDEX IF NOT EXISTS idx_shows_sonarr_id ON shows(sonarr_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_seasons_show_id ON seasons(show_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_episodes_season_id ON episodes(season_id)');
    await client.query(
      'CREATE INDEX IF NOT EXISTS idx_episodes_sonarr_id ON episodes(sonarr_episode_id)'
    );
    await client.query(
      'CREATE INDEX IF NOT EXISTS idx_episode_files_episode_id ON episode_files(episode_id)'
    );

    // Insert default settings if they don't exist
    await client.query(`
      INSERT INTO settings (key, value)
      VALUES ('import_mode', 'none')
      ON CONFLICT (key) DO NOTHING
    `);

    await client.query('COMMIT');
    loggerPg.info('Database initialized successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    loggerPg.error('Error initializing database:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Function to check if database is initialized
export async function isDatabaseInitialized(): Promise<boolean> {
  try {
    const result = (await db
      .prepare(
        `
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='shows'
    `
      )
      .get()) as { name: string } | undefined;
    return result !== undefined;
  } catch (error) {
    logger.error('Error checking database initialization:', error);
    throw error;
  }
}
