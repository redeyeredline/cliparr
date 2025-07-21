// API routes for managing imported shows including listing, fetching details, and batch deletion.
// Provides endpoints for show data retrieval and episode file management from the database.

import express from 'express';
import {
  getImportedShows,
  getShowById,
  deleteShowsByIds,
  getShowWithDetails,
  getEpisodeFiles,
  createProcessingJobsForShows,
  getEpisodeFileIdAndJobIdForShows,
} from '../database/Db_Operations.js';
import { enqueueEpisodeProcessing } from '../services/queue.js';
import { appLogger } from '../services/logger.js';
import { deleteShowsAndCleanup } from '../services/cleanupService.js';

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
    const show = includeDetails ? getShowWithDetails(db, showId) : getShowById(db, showId);

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
router.post('/delete', async (req, res) => {
  const db = req.app.get('db');
  const logger = req.app.get('logger');
  const { ids } = req.body;

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'ids must be a non-empty array' });
  }

  try {
    const result = await deleteShowsAndCleanup(ids, db);
    res.json({ success: true, ...result });
  } catch (error) {
    logger.error('Failed to cascade delete shows:', error);
    res.status(500).json({ error: 'Failed to cascade delete shows' });
  }
});

// Scan shows for file processing
router.post('/scan', async (req, res) => {
  const db = req.app.get('db');
  const { showIds } = req.body;

  appLogger.info('Scan request received:', {
    showIds,
    type: typeof showIds,
    length: Array.isArray(showIds) ? showIds.length : undefined,
  });

  if (!Array.isArray(showIds) || showIds.length === 0) {
    appLogger.warn('Invalid showIds:', { showIds });
    return res.status(400).json({ error: 'showIds must be a non-empty array' });
  }

  try {
    appLogger.info('Creating processing jobs for shows...', { showIds });
    const scannedCount = createProcessingJobsForShows(db, showIds);
    appLogger.info('Processing jobs created:', { scannedCount });

    appLogger.info('Getting episode file IDs and job IDs...');
    let episodeFileAndJobIds = getEpisodeFileIdAndJobIdForShows(db, showIds);
    appLogger.info('Episode file and job IDs retrieved:', {
      count: episodeFileAndJobIds.length,
      data: episodeFileAndJobIds.map((e) => ({
        ...e,
        dbJobIdType: typeof e.dbJobId,
        episodeFileIdType: typeof e.episodeFileId,
      })),
    });

    // Enhanced filtering and validation
    episodeFileAndJobIds = episodeFileAndJobIds.filter((e) => {
      const isValid = e.dbJobId !== null && e.episodeFileId !== null;
      if (!isValid) {
        appLogger.warn('Filtering out invalid entry:', {
          episodeFileId: e.episodeFileId,
          dbJobId: e.dbJobId,
        });
      }
      return isValid;
    });
    appLogger.info('Filtered episode file and job IDs:', {
      count: episodeFileAndJobIds.length,
      data: episodeFileAndJobIds,
    });

    if (episodeFileAndJobIds.length === 0) {
      appLogger.warn('No valid processing jobs found for selected shows', { showIds });
      return res.status(400).json({ error: 'No valid processing jobs found for selected shows.' });
    }

    // Additional validation before enqueuing
    const validEntries = episodeFileAndJobIds.filter((e) => {
      const episodeFileId = Number(e.episodeFileId);
      const dbJobId = Number(e.dbJobId);
      const isValid = !isNaN(episodeFileId) && !isNaN(dbJobId) && episodeFileId > 0 && dbJobId > 0;
      if (!isValid) {
        appLogger.warn('Filtering out non-numeric or zero IDs:', {
          episodeFileId: e.episodeFileId,
          dbJobId: e.dbJobId,
          numericEpisodeFileId: episodeFileId,
          numericDbJobId: dbJobId,
        });
      }
      return isValid;
    });

    if (validEntries.length === 0) {
      appLogger.warn('No valid numeric processing jobs found for selected shows', { showIds });
      return res
        .status(400)
        .json({ error: 'No valid numeric processing jobs found for selected shows.' });
    }

    appLogger.info('Enqueuing episode processing jobs...', { validEntries });
    const enqueuedJobIds = await enqueueEpisodeProcessing(validEntries);
    appLogger.info('Episode processing jobs enqueued:', { enqueuedJobIds });

    res.json({
      success: true,
      scanned: scannedCount,
      enqueued: enqueuedJobIds.length,
      message: `Enqueued ${enqueuedJobIds.length} episodes for processing`,
    });
  } catch (err) {
    let errorDetails = {};
    try {
      errorDetails = Object.getOwnPropertyNames(err).reduce((acc, key) => {
        acc[key] = err[key];
        return acc;
      }, {});
    } catch (e) {}
    appLogger.error('Failed to scan shows:', {
      error: err.message,
      stack: err.stack,
      showIds,
      errorType: err.constructor ? err.constructor.name : undefined,
      errorDetails: JSON.stringify(errorDetails),
    });
    res
      .status(500)
      .json({
        error: err && err.message ? err.message : 'Unknown error',
        stack: err && err.stack ? err.stack : undefined,
      });
  }
});

// Rescan shows with fingerprint data invalidation
router.post('/rescan', async (req, res) => {
  const db = req.app.get('db');
  const { showIds } = req.body;

  if (!Array.isArray(showIds) || showIds.length === 0) {
    return res.status(400).json({ error: 'showIds must be a non-empty array' });
  }

  try {
    // Import the fingerprint pipeline functions
    const { invalidateFingerprintData } = await import('../services/fingerprintPipeline.js');

    // Invalidate fingerprint data for each show
    let invalidatedCount = 0;
    for (const showId of showIds) {
      const count = await invalidateFingerprintData(showId);
      invalidatedCount += count;
    }

    // Create processing jobs for the files
    const scannedCount = createProcessingJobsForShows(db, showIds);

    // Get episode file IDs for the shows
    const episodeFileIds = getEpisodeFileIdAndJobIdForShows(db, showIds);

    // Enqueue episode processing jobs with episode file IDs
    const enqueuedJobIds = await enqueueEpisodeProcessing(episodeFileIds);

    appLogger.info(
      {
        showIds,
        invalidatedCount,
        scannedCount,
        episodeFileIds,
        enqueuedJobIds,
      },
      'Shows rescanned with fingerprint invalidation',
    );

    res.json({
      success: true,
      invalidated: invalidatedCount,
      scanned: scannedCount,
      enqueued: enqueuedJobIds.length,
      message: `Invalidated ${invalidatedCount} fingerprint records and enqueued ${enqueuedJobIds.length} episodes for processing`,
    });
  } catch (error) {
    console.error('Failed to rescan shows:', error);
    appLogger.error('Failed to rescan shows:', error, error && error.stack ? error.stack : '');
    res.status(500).json({ error: 'Failed to rescan shows', details: error && error.message });
  }
});

// Get detection statistics for a show
router.get('/:showId/detection-stats', async (req, res) => {
  const { showId } = req.params;

  if (!showId || isNaN(parseInt(showId))) {
    return res.status(400).json({ error: 'Invalid show ID' });
  }

  try {
    // Import the fingerprint pipeline functions
    const { getDetectionStats } = await import('../services/fingerprintPipeline.js');

    const stats = await getDetectionStats(parseInt(showId));

    appLogger.info(
      {
        showId,
        statsCount: stats.length,
      },
      'Retrieved detection statistics for show',
    );

    res.json({
      success: true,
      showId: parseInt(showId),
      stats,
    });
  } catch (error) {
    console.error('Failed to get detection stats:', error);
    appLogger.error(
      'Failed to get detection stats:',
      error,
      error && error.stack ? error.stack : '',
    );
    res
      .status(500)
      .json({ error: 'Failed to get detection stats', details: error && error.message });
  }
});

// Get detailed segment information for a show/season
router.get('/:showId/segments', async (req, res) => {
  const { showId } = req.params;
  const { season } = req.query;

  if (!showId || isNaN(parseInt(showId))) {
    return res.status(400).json({ error: 'Invalid show ID' });
  }

  try {
    const db = req.app.get('db');

    let sql = `
      SELECT
        season_number,
        episode_number,
        intro_start, intro_end,
        credits_start, credits_end,
        stingers_data, segments_data,
        confidence_score,
        detection_method,
        approval_status,
        processing_notes
      FROM detection_results
      WHERE show_id = ?
    `;

    const params = [parseInt(showId)];

    if (season && !isNaN(parseInt(season))) {
      sql += ' AND season_number = ?';
      params.push(parseInt(season));
    }

    sql += ' ORDER BY season_number, episode_number';

    const results = db.prepare(sql).all(...params);

    // Parse JSON data for stingers and segments
    const processedResults = results.map((row) => ({
      ...row,
      stingers: row.stingers_data ? JSON.parse(row.stingers_data) : [],
      segments: row.segments_data ? JSON.parse(row.segments_data) : [],
      stingers_data: undefined, // Remove raw data
      segments_data: undefined, // Remove raw data
    }));

    appLogger.info(
      {
        showId,
        season,
        resultCount: processedResults.length,
      },
      'Retrieved detailed segment information',
    );

    res.json({
      success: true,
      showId: parseInt(showId),
      season: season ? parseInt(season) : null,
      segments: processedResults,
    });
  } catch (error) {
    console.error('Failed to get segment information:', error);
    appLogger.error(
      'Failed to get segment information:',
      error,
      error && error.stack ? error.stack : '',
    );
    res
      .status(500)
      .json({ error: 'Failed to get segment information', details: error && error.message });
  }
});

export default router;
