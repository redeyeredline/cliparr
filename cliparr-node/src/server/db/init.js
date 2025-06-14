import pg from 'pg';
import { logger } from '../logger.js';
import { initializeSchema } from './schema.js';
import net from 'net';

// Internal database configuration
const DB_CONFIG = {
  host: 'localhost',
  port: 5432,
  database: 'cliparr',
  user: 'postgres',
  password: 'postgres',
};

// Log database configuration (excluding password)
const logConfig = { ...DB_CONFIG };
delete logConfig.password;
logger.info('Database configuration:', logConfig);

// Log connection string (excluding password)
const getConnectionString = (config) => {
  return `postgresql://${config.user}@${config.host}:${config.port}/${config.database}`;
};

logger.info('Connection string:', getConnectionString(logConfig));

/**
 * Check if PostgreSQL server is running
 * @param {string} host - Database host
 * @param {number} port - Database port
 * @returns {Promise<boolean>}
 */
async function isPostgresRunning(host, port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const timeout = 5000; // 5 second timeout

    socket.setTimeout(timeout);

    socket.on('connect', () => {
      logger.info(`PostgreSQL server is running at ${host}:${port}`);
      socket.destroy();
      resolve(true);
    });

    socket.on('error', (error) => {
      logger.error(`PostgreSQL server is not running at ${host}:${port}:`, {
        error: error.message,
        code: error.code
      });
      socket.destroy();
      resolve(false);
    });

    socket.on('timeout', () => {
      logger.error(`Connection to PostgreSQL server at ${host}:${port} timed out`);
      socket.destroy();
      resolve(false);
    });

    socket.connect(port, host);
  });
}

/**
 * Initialize the database
 * @returns {Promise<void>}
 */
export async function initializeDatabase() {
  logger.info('Starting database initialization...');
  
  // First verify PostgreSQL server is running
  logger.info('Verifying PostgreSQL server is running...');
  const isRunning = await isPostgresRunning(DB_CONFIG.host, DB_CONFIG.port);
  
  if (!isRunning) {
    throw new Error(`PostgreSQL server is not running at ${DB_CONFIG.host}:${DB_CONFIG.port}`);
  }
  
  // First connect to postgres database to check/create our database
  const postgresConfig = {
    ...DB_CONFIG,
    database: 'postgres' // Connect to default postgres database first
  };
  
  logger.info('Attempting to connect to postgres database...', {
    host: postgresConfig.host,
    port: postgresConfig.port,
    user: postgresConfig.user,
    connectionString: getConnectionString(postgresConfig)
  });

  const postgresClient = new pg.Client(postgresConfig);
  
  try {
    await postgresClient.connect();
    logger.info('Successfully connected to postgres database', {
      connectionString: getConnectionString(postgresConfig)
    });

    // Check if our database exists
    const dbCheck = await postgresClient.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [DB_CONFIG.database]
    );
    
    if (dbCheck.rowCount === 0) {
      logger.info(`Database '${DB_CONFIG.database}' does not exist, creating...`);
      await postgresClient.query(`CREATE DATABASE ${DB_CONFIG.database}`);
      logger.info(`Database '${DB_CONFIG.database}' created successfully`);
    } else {
      logger.info(`Database '${DB_CONFIG.database}' already exists`);
    }
  } catch (error) {
    logger.error('Error during initial database setup:', {
      error: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
      where: error.where,
      connectionString: getConnectionString(postgresConfig)
    });
    throw new Error(`Failed to initialize database: ${error.message}`);
  } finally {
    await postgresClient.end();
  }

  // Now connect to our database and initialize schema
  logger.info('Connecting to application database...', {
    host: DB_CONFIG.host,
    port: DB_CONFIG.port,
    database: DB_CONFIG.database,
    user: DB_CONFIG.user,
    connectionString: getConnectionString(DB_CONFIG)
  });

  const client = new pg.Client(DB_CONFIG);
  
  try {
    await client.connect();
    logger.info('Successfully connected to application database', {
      connectionString: getConnectionString(DB_CONFIG)
    });
    
    // Initialize schema
    await initializeSchema(client);
    logger.info('Database schema initialized successfully');
    
    // Setup initial settings
    await setupInitialSettings(client);
    logger.info('Initial settings configured');
    
  } catch (error) {
    logger.error('Error during database initialization:', {
      error: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
      where: error.where,
      connectionString: getConnectionString(DB_CONFIG)
    });
    throw new Error(`Failed to initialize database: ${error.message}`);
  } finally {
    await client.end();
  }
}

/**
 * Set up initial application settings
 */
async function setupInitialSettings(client) {
  const { query } = await import('./manager.js');
  
  const defaultSettings = {
    'import_mode': 'auto',  // Default import mode
    'scan_interval': '300', // Default scan interval in seconds
    'last_scan': '',        // Last scan timestamp
    'version': '1.0.0'      // Application version
  };

  try {
    for (const [key, value] of Object.entries(defaultSettings)) {
      await query(
        `INSERT INTO settings (key, value)
         VALUES ($1, $2)
         ON CONFLICT (key) DO NOTHING`,
        [key, value]
      );
    }
    logger.info('Initial settings configured successfully');
  } catch (error) {
    logger.error('Error setting up initial settings:', error);
    throw new Error(`Failed to set up initial settings: ${error.message}`);
  }
}

/**
 * Reset the database (for development/testing)
 * WARNING: This will delete all data!
 */
export async function resetDatabase() {
  if (process.env.NODE_ENV !== 'development') {
    throw new Error('Database reset is only allowed in development mode');
  }

  const { query } = await import('./manager.js');
  
  try {
    logger.info('Starting database reset...');
    await query('BEGIN');

    // Drop all tables
    await query(`
      DROP TABLE IF EXISTS 
        episode_files,
        episodes,
        seasons,
        shows,
        settings
      CASCADE
    `);

    await query('COMMIT');
    logger.info('Database reset completed successfully');

    // Reinitialize the database
    await initializeDatabase();
  } catch (error) {
    await query('ROLLBACK');
    logger.error('Error resetting database:', error);
    throw new Error(`Database reset failed: ${error.message}`);
  }
} 