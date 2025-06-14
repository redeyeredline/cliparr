import { Pool } from 'pg';
import { initializeDatabase, verifyDatabaseOperations } from '../src/backend/config/database';
import config from '../src/backend/config/environment';

// Create a test pool with a different database name
const testPool = new Pool({
  ...config.database,
  database: `${config.database.database}_test`
});

describe('Database Operations', () => {
  beforeAll(async () => {
    // Create test database if it doesn't exist
    const tempPool = new Pool({
      ...config.database,
      database: 'postgres' // Connect to default database
    });
    
    try {
      await tempPool.query(`DROP DATABASE IF EXISTS ${config.database.database}_test`);
      await tempPool.query(`CREATE DATABASE ${config.database.database}_test`);
    } finally {
      await tempPool.end();
    }
  });

  afterAll(async () => {
    await testPool.end();
  });

  describe('Database Initialization', () => {
    it('should initialize database schema successfully', async () => {
      const result = await initializeDatabase();
      expect(result).toBe(true);
    });

    it('should create all required tables', async () => {
      const tables = ['shows', 'seasons', 'episodes', 'episode_files', 'settings'];
      
      for (const table of tables) {
        const result = await testPool.query(
          `SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = $1
          )`,
          [table]
        );
        expect(result.rows[0].exists).toBe(true);
      }
    });
  });

  describe('Database Verification', () => {
    it('should perform test write and read operations', async () => {
      const result = await verifyDatabaseOperations();
      expect(result.success).toBe(true);
      expect(result.timestamp).toBeDefined();
    });

    it('should handle database errors gracefully', async () => {
      // Temporarily break the connection
      await testPool.end();
      
      const result = await verifyDatabaseOperations();
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      
      // Restore connection
      await testPool.connect();
    });
  });

  describe('Settings Table Operations', () => {
    it('should insert and retrieve settings', async () => {
      const testKey = 'test_setting';
      const testValue = 'test_value';
      
      // Insert
      await testPool.query(
        'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2',
        [testKey, testValue]
      );
      
      // Retrieve
      const result = await testPool.query(
        'SELECT value FROM settings WHERE key = $1',
        [testKey]
      );
      
      expect(result.rows[0].value).toBe(testValue);
    });

    it('should update existing settings', async () => {
      const testKey = 'test_setting';
      const newValue = 'updated_value';
      
      // Update
      await testPool.query(
        'UPDATE settings SET value = $1 WHERE key = $2',
        [newValue, testKey]
      );
      
      // Verify
      const result = await testPool.query(
        'SELECT value FROM settings WHERE key = $1',
        [testKey]
      );
      
      expect(result.rows[0].value).toBe(newValue);
    });
  });
}); 