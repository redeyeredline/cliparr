import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Database configuration
const pool = new Pool({
  user: process.env.POSTGRES_USER || 'postgres',
  host: process.env.POSTGRES_HOST || 'localhost',
  database: process.env.POSTGRES_DB || 'cliparr',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
});

// Test database connection
export const testConnection = async () => {
  try {
    const client = await pool.connect();
    client.release();
    return true;
  } catch (error) {
    console.error('Database connection error:', error);
    return false;
  }
};

// Silently initialize database schema
export const initializeDatabase = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Create shows table
    await client.query(`
      CREATE TABLE IF NOT EXISTS shows (
        id SERIAL PRIMARY KEY,
        sonarr_id INTEGER UNIQUE NOT NULL,
        title VARCHAR(255) NOT NULL,
        overview TEXT,
        status VARCHAR(50),
        network VARCHAR(255),
        air_time VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create seasons table
    await client.query(`
      CREATE TABLE IF NOT EXISTS seasons (
        id SERIAL PRIMARY KEY,
        show_id INTEGER REFERENCES shows(id) ON DELETE CASCADE,
        season_number INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(show_id, season_number)
      );
    `);

    // Create episodes table
    await client.query(`
      CREATE TABLE IF NOT EXISTS episodes (
        id SERIAL PRIMARY KEY,
        season_id INTEGER REFERENCES seasons(id) ON DELETE CASCADE,
        sonarr_episode_id INTEGER UNIQUE NOT NULL,
        title VARCHAR(255) NOT NULL,
        overview TEXT,
        episode_number INTEGER NOT NULL,
        air_date DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(season_id, episode_number)
      );
    `);

    // Create episode_files table
    await client.query(`
      CREATE TABLE IF NOT EXISTS episode_files (
        id SERIAL PRIMARY KEY,
        episode_id INTEGER REFERENCES episodes(id) ON DELETE CASCADE,
        path VARCHAR(1024) NOT NULL,
        size BIGINT,
        quality VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create settings table
    await client.query(`
      CREATE TABLE IF NOT EXISTS settings (
        id SERIAL PRIMARY KEY,
        key VARCHAR(50) UNIQUE NOT NULL,
        value TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query('COMMIT');
    return true;
  } catch (error: unknown) {
    await client.query('ROLLBACK');
    console.error('Database initialization error:', error instanceof Error ? error.message : String(error));
    return false;
  } finally {
    client.release();
  }
};

// Verify database operations by performing a test write and read
export const verifyDatabaseOperations = async () => {
  const client = await pool.connect();
  try {
    // Test write
    await client.query('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2', 
      ['test_key', new Date().toISOString()]);
    
    // Test read
    const result = await client.query('SELECT value FROM settings WHERE key = $1', ['test_key']);
    
    return {
      success: true,
      timestamp: result.rows[0]?.value
    };
  } catch (error: unknown) {
    console.error('Database verification error:', error instanceof Error ? error.message : String(error));
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  } finally {
    client.release();
  }
};

export default pool; 