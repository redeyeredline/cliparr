// src/routes/settings.js - Settings API routes
import express from 'express';
const router = express.Router();
import { getDb, getImportMode, setImportMode } from '../database/Db_Operations.js';

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

export default router;
