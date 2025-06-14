import { Router } from 'express';
import { db } from '../config/database';
import { logger } from '../utils/logger';

const router = Router();

router.get('/db-test', async (req, res) => {
  logger.info('Received /api/db-test request');
  try {
    const result = (await db.prepare('SELECT 1 as result').get()) as { result: number } | undefined;
    logger.info({ msg: 'DB test query successful', result });
    res.json({ status: 'ok', db: result });
  } catch (err) {
    logger.error({ msg: 'DB test query failed', error: err instanceof Error ? err.message : err });
    res.status(500).json({ status: 'error', error: 'Database not reachable' });
  }
});

export default router;
