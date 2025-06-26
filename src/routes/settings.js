// API routes for application settings management including import modes and polling intervals.
// Handles CRUD operations for Sonarr configuration, processing settings, and system preferences.

import express from 'express';
const router = express.Router();
import {
  getDb,
  getImportMode,
  setImportMode,
  getPollingInterval,
  setPollingInterval,
  getSetting,
  setSetting,
} from '../database/Db_Operations.js';
import { logger } from '../services/logger.js';

// GET current import mode
router.get('/import-mode', async (req, res) => {
  const db = await getDb();
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
router.post('/import-mode', async (req, res) => {
  const db = await getDb();
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
      await importTaskManager.updateInterval();

      // Trigger immediate scan when switching to auto mode
      if (mode === 'auto') {
        await importTaskManager.runTask(true);
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
router.get('/polling-interval', async (req, res) => {
  const db = await getDb();
  try {
    const interval = getPollingInterval(db);
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
router.post('/polling-interval', async (req, res) => {
  const db = await getDb();
  const { interval } = req.body;
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
      await importTaskManager.updateInterval();
    }

    const savedInterval = getPollingInterval(db);
    res.json({ status: 'ok', interval: savedInterval });
  } catch (error) {
    logger.error('Failed to set polling interval:', error);
    res.status(500).json({
      error: 'Failed to set polling interval',
      details: error && (error.stack || error.message || error),
    });
  }
});

// GET all settings
router.get('/all', async (req, res) => {
  const db = await getDb();
  try {
    const keys = [
      'sonarr_url',
      'sonarr_api_key',
      'output_directory',
      'min_confidence_threshold',
      'backup_originals',
      'auto_process_verified',
      'import_mode',
      'polling_interval',
    ];
    const settings = {};
    for (const key of keys) {
      settings[key] = getSetting(db, key, null);
    }
    res.json(settings);
  } catch (error) {
    logger.error('Failed to get all settings:', error);
    res.status(500).json({ error: 'Failed to get all settings' });
  }
});

// POST update all settings
router.post('/all', async (req, res) => {
  const db = await getDb();
  const {
    sonarr_url,
    sonarr_api_key,
    output_directory,
    min_confidence_threshold,
    backup_originals,
    auto_process_verified,
    import_mode,
    polling_interval,
  } = req.body;
  try {
    setSetting(db, 'sonarr_url', sonarr_url || '');
    setSetting(db, 'sonarr_api_key', sonarr_api_key || '');
    setSetting(db, 'output_directory', output_directory || '');
    setSetting(db, 'min_confidence_threshold',
      min_confidence_threshold !== undefined ? String(min_confidence_threshold) : '0.8');
    setSetting(db, 'backup_originals', backup_originals ? '1' : '0');
    setSetting(db, 'auto_process_verified', auto_process_verified ? '1' : '0');
    if (import_mode) {
      setImportMode(db, import_mode);
    }
    if (polling_interval) {
      setPollingInterval(db, parseInt(polling_interval, 10));
    }
    res.json({ status: 'ok' });
  } catch (error) {
    logger.error('Failed to update all settings:', error);
    res.status(500).json({ error: 'Failed to update all settings' });
  }
});

export default router;
