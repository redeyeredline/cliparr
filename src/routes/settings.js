// API routes for application settings management including import modes and polling intervals.
// Handles CRUD operations for Sonarr configuration, processing settings, and system preferences.

import express from 'express';
import {
  getDb,
  getImportMode,
  setImportMode,
  getPollingInterval,
  setPollingInterval,
  getSetting,
  setSetting,
} from '../database/Db_Operations.js';
import { updateWorkerLimits, pauseCpuWorkers, resumeCpuWorkers, pauseGpuWorkers, resumeGpuWorkers } from '../services/queue.js';
import { logger } from '../services/logger.js';
import os from 'os';
import path from 'path';
import fs from 'fs/promises';

const router = express.Router();

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
      'temp_dir',
      'cpu_worker_limit',
      'gpu_worker_limit',
    ];
    const settings = {};
    for (const key of keys) {
      settings[key] = getSetting(db, key, null);
    }
    // Default temp_dir if not set
    if (!settings.temp_dir) {
      settings.temp_dir = path.join(os.tmpdir(), 'cliprr');
    }
    // Default worker limits if not set
    if (!settings.cpu_worker_limit) {
      settings.cpu_worker_limit = '2';
    }
    if (!settings.gpu_worker_limit) {
      settings.gpu_worker_limit = '1';
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
    temp_dir,
    cpu_worker_limit,
    gpu_worker_limit,
  } = req.body;
  try {
    if (sonarr_url) {
      setSetting(db, 'sonarr_url', sonarr_url);
    }
    if (sonarr_api_key && !sonarr_api_key.includes('*')) {
      setSetting(db, 'sonarr_api_key', sonarr_api_key);
    }
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
    if (temp_dir) {
      setSetting(db, 'temp_dir', temp_dir);
    }
    // Only update worker limits if present and valid
    if (cpu_worker_limit !== undefined && !isNaN(cpu_worker_limit)) {
      setSetting(db, 'cpu_worker_limit', String(Math.max(1, Math.min(16, parseInt(cpu_worker_limit, 10)))));
    }
    if (gpu_worker_limit !== undefined && !isNaN(gpu_worker_limit)) {
      setSetting(db, 'gpu_worker_limit', String(Math.max(1, Math.min(8, parseInt(gpu_worker_limit, 10)))));
    }

    // Update worker limits if CPU or GPU limits were changed
    if ((cpu_worker_limit !== undefined && !isNaN(cpu_worker_limit)) || (gpu_worker_limit !== undefined && !isNaN(gpu_worker_limit))) {
      try {
        await updateWorkerLimits();
        logger.info('Worker limits updated successfully');
      } catch (error) {
        logger.error('Failed to update worker limits:', error);
        // Don't fail the entire request, just log the error
      }
    }

    res.json({ status: 'ok' });
  } catch (error) {
    logger.error('Failed to update all settings:', error);
    res.status(500).json({ error: 'Failed to update all settings' });
  }
});

// List subfolders for a given path (default /media)
router.get('/filesystem/list', async (req, res) => {
  let basePath = req.query.path || '/media';
  try {
    // Prevent navigation above root
    basePath = path.resolve('/', basePath);
    const entries = await fs.readdir(basePath, { withFileTypes: true });
    const folders = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => ({ name: entry.name, path: path.join(basePath, entry.name) }));
    // Optionally, sort folders alphabetically
    folders.sort((a, b) => a.name.localeCompare(b.name));
    res.json({ folders, parent: basePath === '/' ? null : path.dirname(basePath) });
  } catch (error) {
    console.error('Failed to list folders:', basePath, error);
    res.status(500).json({ error: 'Failed to list folders', details: error.message });
  }
});

// POST pause CPU workers
router.post('/queue/pause-cpu', async (req, res) => {
  try {
    await pauseCpuWorkers();
    res.json({ status: 'ok' });
  } catch (error) {
    logger.error('Failed to pause CPU workers:', error);
    res.status(500).json({ error: 'Failed to pause CPU workers' });
  }
});

// POST resume CPU workers
router.post('/queue/resume-cpu', async (req, res) => {
  try {
    await resumeCpuWorkers();
    res.json({ status: 'ok' });
  } catch (error) {
    logger.error('Failed to resume CPU workers:', error);
    res.status(500).json({ error: 'Failed to resume CPU workers' });
  }
});

// POST pause GPU workers
router.post('/queue/pause-gpu', async (req, res) => {
  try {
    await pauseGpuWorkers();
    res.json({ status: 'ok' });
  } catch (error) {
    logger.error('Failed to pause GPU workers:', error);
    res.status(500).json({ error: 'Failed to pause GPU workers' });
  }
});

// POST resume GPU workers
router.post('/queue/resume-gpu', async (req, res) => {
  try {
    await resumeGpuWorkers();
    res.json({ status: 'ok' });
  } catch (error) {
    logger.error('Failed to resume GPU workers:', error);
    res.status(500).json({ error: 'Failed to resume GPU workers' });
  }
});

// Validate temp directory (try to create a test file/folder)
router.post('/validate-temp-dir', async (req, res) => {
  const { temp_dir } = req.body;
  const pathToTest = path.join(temp_dir, 'cliprr_test');
  try {
    await fs.mkdir(pathToTest, { recursive: true });
    const testFile = path.join(pathToTest, 'test.txt');
    await fs.writeFile(testFile, 'ok');
    await fs.unlink(testFile);
    await fs.rmdir(pathToTest);
    res.json({ valid: true });
  } catch (err) {
    res.json({ valid: false, error: err.message });
  }
});

export default router;
