import express from 'express';
import { query } from '../db/manager.js';
import { logger } from '../logger.js';

const router = express.Router();

/**
 * Get database status
 * Returns information about the database connection and schema
 */
router.get('/status', async (req, res) => {
  try {
    // Check database connection
    const { rows: [version] } = await query('SELECT version()');
    
    // Get table counts
    const { rows: [counts] } = await query(`
      SELECT 
        (SELECT COUNT(*) FROM shows) as shows_count,
        (SELECT COUNT(*) FROM seasons) as seasons_count,
        (SELECT COUNT(*) FROM episodes) as episodes_count,
        (SELECT COUNT(*) FROM episode_files) as files_count
    `);

    // Get database size
    const { rows: [size] } = await query(`
      SELECT pg_size_pretty(pg_database_size(current_database())) as db_size
    `);

    res.json({
      status: 'healthy',
      version: version.version,
      counts,
      size: size.db_size,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting database status:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get database status',
      error: error.message
    });
  }
});

export default router; 