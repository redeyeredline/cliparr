// src/integration/routes/api.js - General API routes
import express from 'express';
import { getDb, getPerformanceStats } from '../database/Db_Operations.js';

const router = express.Router();

// Health check endpoint
router.get('/status', (req, res) => {
  const logger = req.app.get('logger');
  logger.info('Health check requested');

  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    database: 'connected',
    server: 'integrated-backend',
  });
});

// Database test endpoint
router.get('/db-test', (req, res) => {
  const db = req.app.get('db');
  const logger = req.app.get('logger');

  try {
    const testResult = db.transaction(() => {
      db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
        .run('test_key', 'test_value');

      const result = db.prepare('SELECT value FROM settings WHERE key = ?')
        .get('test_key');

      return {
        success: true,
        message: 'Database test successful',
        testValue: result?.value,
        timestamp: new Date().toISOString(),
      };
    })();

    res.json(testResult);
  } catch (error) {
    logger.error('Database test failed:', error);
    res.status(500).json({
      success: false,
      message: 'Database test failed',
      error: error.message,
    });
  }
});

// System diagnostics endpoint
router.get('/system/diagnostics', async (req, res) => {
  const db = getDb();
  const dbStats = getPerformanceStats();
  res.json({
    uptime: process.uptime(), // seconds
    dbStats,
  });
});

export default router;
