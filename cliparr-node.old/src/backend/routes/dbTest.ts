import express, { Request, Response } from 'express';
import { db } from '../config/database';
import { logger } from '../utils/logger';
import type { RequestHandler } from 'express';

const router = express.Router();

router.get('/test', (async (req: Request, res: Response) => {
  try {
    // Test show insertion
    const showStmt = db.prepare(`
      INSERT INTO shows (sonarr_id, title, path, status)
      VALUES (?, ?, ?, ?)
      RETURNING *
    `);
    const showResult = showStmt.get(999999, 'Test Show', '/test/path', 'pending') as { id: number };
    const showId = showResult.id;

    // Test episode insertion
    const episodeStmt = db.prepare(`
      INSERT INTO episodes (show_id, sonarr_id, season_number, episode_number, title, path, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      RETURNING *
    `);
    const episodeResult = episodeStmt.get(
      showId,
      999999,
      1,
      1,
      'Test Episode',
      '/test/file.mkv',
      'pending'
    ) as { id: number };
    const episodeId = episodeResult.id;

    // Verify all insertions
    const showSelectStmt = db.prepare('SELECT * FROM shows WHERE id = ?');
    const episodeSelectStmt = db.prepare('SELECT * FROM episodes WHERE id = ?');
    const show = showSelectStmt.get(showId);
    const episode = episodeSelectStmt.get(episodeId);

    // Clean up test data
    const deleteStmt = db.prepare('DELETE FROM shows WHERE id = ?');
    deleteStmt.run(showId);

    res.json({
      status: 'success',
      message: 'Database operations test completed successfully',
      data: {
        show,
        episode,
      },
    });
  } catch (error) {
    logger.error('Database test error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Database test failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}) as RequestHandler);

export default router;
