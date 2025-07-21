// Provides health check and database test endpoints for monitoring and diagnostics.
// Used to verify backend and database status from the frontend or external tools.
// src/integration/routes/api.js - General API routes
import express from 'express';
import { getPerformanceStats } from '../database/Db_Operations.js';

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
      // Just test a simple query without modifying settings
      const result = db.prepare('SELECT COUNT(*) as count FROM settings').get();

      return {
        success: true,
        message: 'Database test successful',
        settingsCount: result?.count,
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
  const dbStats = getPerformanceStats();
  res.json({
    uptime: process.uptime(), // seconds
    dbStats,
  });
});

export default router;
