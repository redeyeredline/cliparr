// API routes for managing imported shows including listing, fetching details, and batch deletion.
// Provides endpoints for show data retrieval and episode file management from the database.

import express from 'express';
import { getImportedShows, getShowById, deleteShowsByIds, getShowWithDetails, getEpisodeFiles, createProcessingJobsForShows } from '../database/Db_Operations.js';
import { enqueueShowProcessing } from '../services/queue.js';

const router = express.Router();

// Get all shows
router.get('/', (req, res) => {
  const db = req.app.get('db');
  const logger = req.app.get('logger');

  try {
    const { shows, total } = getImportedShows(db, 1, 1000000); // large page size to get all
    res.json({ shows, total });
  } catch (error) {
    logger.error('Failed to fetch shows:', error);
    res.status(500).json({ error: 'Failed to fetch shows' });
  }
});

// Get specific show by ID
router.get('/:id', (req, res) => {
  const db = req.app.get('db');
  const logger = req.app.get('logger');
  const showId = parseInt(req.params.id);
  const includeDetails = req.query.details === 'true';

  if (isNaN(showId)) {
    return res.status(400).json({ error: 'Invalid show ID' });
  }

  try {
    const show = includeDetails
      ? getShowWithDetails(db, showId)
      : getShowById(db, showId);

    if (!show) {
      return res.status(404).json({ error: 'Show not found' });
    }
    res.json(show);
  } catch (error) {
    logger.error('Failed to fetch show:', error);
    res.status(500).json({ error: 'Failed to fetch show' });
  }
});

// Get episode files for a specific episode
router.get('/episodes/:episodeId/files', (req, res) => {
  const db = req.app.get('db');
  const logger = req.app.get('logger');
  const episodeId = parseInt(req.params.episodeId);

  if (isNaN(episodeId)) {
    return res.status(400).json({ error: 'Invalid episode ID' });
  }

  try {
    const files = getEpisodeFiles(db, episodeId);
    res.json({ files });
  } catch (error) {
    logger.error('Failed to fetch episode files:', error);
    res.status(500).json({ error: 'Failed to fetch episode files' });
  }
});

// Batch delete shows
router.post('/delete', (req, res) => {
  const db = req.app.get('db');
  const logger = req.app.get('logger');
  const { ids } = req.body;

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'ids must be a non-empty array' });
  }

  try {
    const deletedCount = deleteShowsByIds(db, ids);
    res.json({ success: true, deleted: deletedCount });
  } catch (error) {
    logger.error('Failed to cascade delete shows:', error);
    res.status(500).json({ error: 'Failed to cascade delete shows' });
  }
});

// Scan shows for file processing
router.post('/scan', async (req, res) => {
  const db = req.app.get('db');
  const logger = req.app.get('logger');
  const { showIds } = req.body;

  if (!Array.isArray(showIds) || showIds.length === 0) {
    return res.status(400).json({ error: 'showIds must be a non-empty array' });
  }

  try {
    // Create processing jobs for the files
    const scannedCount = createProcessingJobsForShows(db, showIds);

    // Enqueue show processing jobs (as a batch)
    const enqueuedJobId = await enqueueShowProcessing(showIds);

    logger.info({
      showIds,
      scannedCount,
      enqueuedJobId,
    }, 'Shows scanned and enqueued for processing');

    res.json({
      success: true,
      scanned: scannedCount,
      enqueued: 1,
      message: `Enqueued ${showIds.length} shows for processing`,
    });
  } catch (error) {
    console.error('Failed to scan shows:', error);
    logger.error('Failed to scan shows:', error, error && error.stack ? error.stack : '');
    res.status(500).json({ error: 'Failed to scan shows', details: error && error.message });
  }
});

export default router;
