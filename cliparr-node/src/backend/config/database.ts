import { Pool } from 'pg';
import { logger } from '../utils/logger';

// Generate a random password for the database
const generateDbPassword = () => {
  return Math.random().toString(36).slice(-12);
};

// Database configuration
const dbConfig = {
  user: 'postgres',
  host: 'localhost',
  database: 'cliparr',
  password: process.env.POSTGRES_PASSWORD || generateDbPassword(),
  port: 5432,
};

// Create the connection pool
const pool = new Pool(dbConfig);

// Test the database connection
const testConnection = async () => {
  try {
    const client = await pool.connect();
    logger.info('Successfully connected to PostgreSQL database');
    client.release();
    return true;
  } catch (error) {
    logger.error('Failed to connect to PostgreSQL database:', error);
    return false;
  }
};

// Initialize database tables
const initializeDatabase = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Create shows table
    await client.query(`
      CREATE TABLE IF NOT EXISTS shows (
        id SERIAL PRIMARY KEY,
        sonarr_id INTEGER UNIQUE NOT NULL,
        title VARCHAR(255) NOT NULL,
        path VARCHAR(255) NOT NULL,
        status VARCHAR(50) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create episodes table
    await client.query(`
      CREATE TABLE IF NOT EXISTS episodes (
        id SERIAL PRIMARY KEY,
        show_id INTEGER REFERENCES shows(id) ON DELETE CASCADE,
        sonarr_id INTEGER UNIQUE NOT NULL,
        season_number INTEGER NOT NULL,
        episode_number INTEGER NOT NULL,
        title VARCHAR(255) NOT NULL,
        path VARCHAR(255) NOT NULL,
        status VARCHAR(50) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create settings table
    await client.query(`
      CREATE TABLE IF NOT EXISTS settings (
        id SERIAL PRIMARY KEY,
        key VARCHAR(50) UNIQUE NOT NULL,
        value TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query('COMMIT');
    logger.info('Database tables initialized successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Failed to initialize database tables:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Verify database operations by performing a test write and read
const verifyDatabaseOperations = async () => {
  const client = await pool.connect();
  try {
    // Test write
    await client.query(
      'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2',
      ['test_key', new Date().toISOString()]
    );

    // Test read
    const result = await client.query('SELECT value FROM settings WHERE key = $1', ['test_key']);

    return {
      success: true,
      timestamp: result.rows[0]?.value,
    };
  } catch (error) {
    logger.error('Database verification error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    client.release();
  }
};

export { pool, testConnection, initializeDatabase, verifyDatabaseOperations };
