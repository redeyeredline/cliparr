import pool from './db';
import pino from 'pino';

const logger = pino({
  transport:
    process.env.NODE_ENV !== 'production'
      ? {
          target: 'pino-pretty',
          options: { colorize: true },
        }
      : undefined,
});

export async function initializeDb() {
  logger.info('Initializing PostgreSQL database schema...');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Shows table
    await client.query(`
      CREATE TABLE IF NOT EXISTS shows (
        id SERIAL PRIMARY KEY,
        sonarr_id INTEGER UNIQUE NOT NULL,
        title TEXT NOT NULL,
        overview TEXT,
        path TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    // Seasons table
    await client.query(`
      CREATE TABLE IF NOT EXISTS seasons (
        id SERIAL PRIMARY KEY,
        show_id INTEGER NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
        season_number INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(show_id, season_number)
      )
    `);
    // Episodes table
    await client.query(`
      CREATE TABLE IF NOT EXISTS episodes (
        id SERIAL PRIMARY KEY,
        season_id INTEGER NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
        episode_number INTEGER NOT NULL,
        title TEXT NOT NULL,
        sonarr_episode_id INTEGER UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(season_id, episode_number)
      )
    `);
    // Episode files table
    await client.query(`
      CREATE TABLE IF NOT EXISTS episode_files (
        id SERIAL PRIMARY KEY,
        episode_id INTEGER NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
        file_path TEXT NOT NULL,
        size INTEGER,
        quality TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    // Settings table
    await client.query(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      )
    `);
    // Indexes
    await client.query('CREATE INDEX IF NOT EXISTS idx_shows_title ON shows(title)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_shows_sonarr_id ON shows(sonarr_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_seasons_show_id ON seasons(show_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_episodes_season_id ON episodes(season_id)');
    await client.query(
      'CREATE INDEX IF NOT EXISTS idx_episodes_sonarr_episode_id ON episodes(sonarr_episode_id)'
    );
    await client.query('COMMIT');
    logger.info('Database schema initialized successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    if (err instanceof Error) {
      logger.error({ msg: 'Error initializing database schema', error: err.message });
    } else {
      logger.error({ msg: 'Error initializing database schema', error: err });
    }
    throw err;
  } finally {
    client.release();
  }
}
