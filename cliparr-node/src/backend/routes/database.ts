import { Router } from 'express';
import { verifyDatabaseOperations } from '../config/database';

const router = Router();

// Verify database operations
router.get('/verify', async (req, res) => {
  try {
    const result = await verifyDatabaseOperations();
    if (result.success) {
      res.json({
        status: 'success',
        message: 'Database operations verified',
        timestamp: result.timestamp,
      });
    } else {
      res.status(500).json({
        status: 'error',
        message: 'Database verification failed',
        error: result.error,
      });
    }
  } catch (error: unknown) {
    res.status(500).json({
      status: 'error',
      message: 'Database verification failed',
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;
