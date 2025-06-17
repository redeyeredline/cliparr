// src/routes/settings.js - Settings API routes
import express from 'express';
const router = express.Router();
import { getDb, getImportMode, setImportMode, getPollingInterval, setPollingInterval } from '../database/Db_Operations.js';

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
    if (!mode || !['auto', 'import', 'none'].includes(mode)) {
      return res.status(400).json({ error: 'Invalid import mode.' });
    }
    setImportMode(db, mode);
    res.json({ status: 'ok', mode });
  } catch (error) {
    console.error('Failed to set import mode:', error);
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
    res.json({ interval });
  } catch (error) {
    console.error('Failed to get polling interval:', error);
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
  try {
    if (!interval || isNaN(interval) || interval < 60 || interval > 86400) {
      return res.status(400).json({
        error: 'Invalid polling interval. Must be between 60 and 86400 seconds.',
      });
    }
    setPollingInterval(db, parseInt(interval, 10));
    res.json({ status: 'ok', interval: parseInt(interval, 10) });
  } catch (error) {
    console.error('Failed to set polling interval:', error);
    res.status(500).json({
      error: 'Failed to set polling interval',
      details: error && (error.stack || error.message || error),
    });
  }
});

export default router;
