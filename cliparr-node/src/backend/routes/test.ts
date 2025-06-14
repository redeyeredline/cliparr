import { Router } from 'express';
import pool from '../models/db';
import pino from 'pino';

const logger = pino({
  transport: process.env.NODE_ENV !== 'production' ? {
    target: 'pino-pretty',
    options: { colorize: true }
  } : undefined
});

const router = Router();

router.get('/db-test', async (req, res) => {
  logger.info('Received /api/db-test request');
  try {
    const result = await pool.query('SELECT 1 as result');
    logger.info({ msg: 'DB test query successful', result: result.rows[0] });
    res.json({ status: 'ok', db: result.rows[0] });
  } catch (err) {
    logger.error({ msg: 'DB test query failed', error: err instanceof Error ? err.message : err });
    res.status(500).json({ status: 'error', error: 'Database not reachable' });
  }
});

export default router; 