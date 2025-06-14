import { initializeDatabase, verifyDatabaseOperations, db } from '../src/backend/config/database';

describe('Database Operations', () => {
  beforeAll(async () => {
    // Ensure database is initialized
    await initializeDatabase();
  });

  afterAll(async () => {
    // Clean up any test data
    await db.run('DELETE FROM settings WHERE key LIKE ?', ['test_%']);
  });

  describe('Database Initialization', () => {
    it('should initialize database schema successfully', async () => {
      const result = await initializeDatabase();
      expect(result).toBe(true);
    });

    it('should create all required tables', async () => {
      const tables = ['shows', 'episodes', 'settings'];

      for (const table of tables) {
        const result = await db.get(
          `SELECT name FROM sqlite_master 
           WHERE type='table' AND name=?`,
          [table]
        );
        expect(result).toBeDefined();
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
      // Temporarily break the connection by closing the database
      await db.close();

      const result = await verifyDatabaseOperations();
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();

      // Restore connection
      await initializeDatabase();
    });
  });

  describe('Settings Table Operations', () => {
    it('should insert and retrieve settings', async () => {
      const testKey = 'test_setting';
      const testValue = 'test_value';

      // Insert
      await db.run(
        'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?',
        [testKey, testValue, testValue]
      );

      // Retrieve
      const result = await db.get('SELECT value FROM settings WHERE key = ?', [testKey]);

      expect(result?.value).toBe(testValue);
    });

    it('should update existing settings', async () => {
      const testKey = 'test_setting';
      const newValue = 'updated_value';

      // Update
      await db.run('UPDATE settings SET value = ? WHERE key = ?', [newValue, testKey]);

      // Verify
      const result = await db.get('SELECT value FROM settings WHERE key = ?', [testKey]);

      expect(result?.value).toBe(newValue);
    });
  });
});
