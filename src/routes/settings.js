// src/routes/settings.js - Settings API routes
import express from 'express';
const router = express.Router();
import {
  getDb,
  getImportMode,
  setImportMode,
  getPollingInterval,
  setPollingInterval,
} from '../database/Db_Operations.js';
import { logger } from '../services/logger.js';

// GET current import mode
router.get('/import-mode', (req, res) => {
  const db = getDb();
  try {
    const mode = getImportMode(db);
    res.json({ mode });
  } catch (error) {
    console.error('Failed to get import mode:', error);
    res.status(500).json({
      error: 'Failed to get import mode',
      details: error && (error.stack || error.message || error),
    });
  }
});

// POST set import mode
router.post('/import-mode', (req, res) => {
  const db = getDb();
  const { mode } = req.body;
  try {
    if (!['auto', 'import', 'none'].includes(mode)) {
      return res.status(400).json({ error: 'Invalid import mode' });
    }

    setImportMode(db, mode);

    // Get the import task manager instance from the app
    const importTaskManager = req.app.get('importTaskManager');
    if (importTaskManager) {
      // This will handle stopping/starting the task based on the new mode
      importTaskManager.updateInterval();

      // Trigger immediate scan when switching to auto mode
      if (mode === 'auto') {
        importTaskManager.runTask(true);
        res.json({ status: 'ok', mode, autoScanTriggered: true });
        return;
      }
    }

    res.json({ status: 'ok', mode });
  } catch (error) {
    logger.error('Failed to set import mode:', error);
    res.status(500).json({
      error: 'Failed to set import mode',
      details: error && (error.stack || error.message || error),
    });
  }
});

// GET current polling interval
router.get('/polling-interval', (req, res) => {
  const db = getDb();
  try {
    const interval = getPollingInterval(db);
    logger.info({ interval }, 'GET polling interval');
    res.json({ interval });
  } catch (error) {
    logger.error('Failed to get polling interval:', error);
    res.status(500).json({
      error: 'Failed to get polling interval',
      details: error && (error.stack || error.message || error),
    });
  }
});

// POST set polling interval
router.post('/polling-interval', (req, res) => {
  const db = getDb();
  const { interval } = req.body;
  logger.info({ interval }, 'POST polling interval');
  try {
    if (!interval || isNaN(interval) || interval < 60 || interval > 86400) {
      return res.status(400).json({
        error: 'Invalid polling interval. Must be between 60 and 86400 seconds.',
      });
    }
    setPollingInterval(db, parseInt(interval, 10));

    // Get the import task manager instance from the app
    const importTaskManager = req.app.get('importTaskManager');
    if (importTaskManager) {
      // This will handle updating the interval or stopping if mode is 'none'
      importTaskManager.updateInterval();
    }

    const savedInterval = getPollingInterval(db);
    logger.info({ savedInterval }, 'Saved polling interval');
    res.json({ status: 'ok', interval: savedInterval });
  } catch (error) {
    logger.error('Failed to set polling interval:', error);
    res.status(500).json({
      error: 'Failed to set polling interval',
      details: error && (error.stack || error.message || error),
    });
  }
});

export default router;
