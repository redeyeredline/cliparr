const { Pool } = require('pg');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/cliparr'
});

const initializeDatabase = async () => {
  const client = await pool.connect();
  try {
    await client.query(`
      -- Enable UUID extension
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

      -- Shows table
      CREATE TABLE IF NOT EXISTS shows (
        id SERIAL PRIMARY KEY,
        sonarr_id INTEGER UNIQUE,
        title TEXT,
        overview TEXT,
        path TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- Seasons table
      CREATE TABLE IF NOT EXISTS seasons (
        id SERIAL PRIMARY KEY,
        show_id INTEGER REFERENCES shows(id) ON DELETE CASCADE,
        season_number INTEGER,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(show_id, season_number)
      );

      -- Episodes table
      CREATE TABLE IF NOT EXISTS episodes (
        id SERIAL PRIMARY KEY,
        season_id INTEGER REFERENCES seasons(id) ON DELETE CASCADE,
        episode_number INTEGER,
        title TEXT,
        sonarr_episode_id INTEGER UNIQUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- Episode files table
      CREATE TABLE IF NOT EXISTS episode_files (
        id SERIAL PRIMARY KEY,
        episode_id INTEGER REFERENCES episodes(id) ON DELETE CASCADE,
        file_path TEXT,
        size BIGINT,
        quality TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- Settings table
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- Audio analysis jobs table
      CREATE TABLE IF NOT EXISTS audio_analysis_jobs (
        id SERIAL PRIMARY KEY,
        show_id INTEGER REFERENCES shows(id) ON DELETE CASCADE,
        show_title TEXT,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP WITH TIME ZONE,
        error TEXT
      );

      -- Create indexes for better performance
      CREATE INDEX IF NOT EXISTS idx_shows_sonarr_id ON shows(sonarr_id);
      CREATE INDEX IF NOT EXISTS idx_episodes_sonarr_episode_id ON episodes(sonarr_episode_id);
      CREATE INDEX IF NOT EXISTS idx_episode_files_episode_id ON episode_files(episode_id);
      CREATE INDEX IF NOT EXISTS idx_audio_analysis_jobs_status ON audio_analysis_jobs(status);
      CREATE INDEX IF NOT EXISTS idx_audio_analysis_jobs_show_id ON audio_analysis_jobs(show_id);

      -- Insert default settings
      INSERT INTO settings (key, value) 
      VALUES ('import_mode', 'auto')
      ON CONFLICT (key) DO NOTHING;
    `);

    console.log('Database schema initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  pool,
  initializeDatabase
}; 