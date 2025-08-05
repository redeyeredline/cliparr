process.on('unhandledRejection', (reason, promise) => {
  // Suppress logging for expected 404s from cleanup job status polling
  if (
    reason &&
    typeof reason === 'object' &&
    reason.message &&
    (reason.message.includes('not found') || reason.message.includes('404'))
  ) {
    return; // Don't log expected 404s
  }

  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

console.warn('Processing API loaded');
// API routes for managing processing jobs including listing, updating, and status management.
// Provides endpoints for processing job data retrieval and manipulation.

import express from 'express';
import {
  getProcessingJobs,
  updateProcessingJob,
  getProcessingJobById,
  getProcessingJobStats,
  deleteProcessingJob,
} from '../database/Db_Operations.js';
import {
  getQueueStatus,
  debugQueueState,
  removeJobFromAllQueues,
  queues,
  enqueueCleanupJob,
} from '../services/queue.js';
import { getDatabaseSingleton } from '../database/Auto_DB_Setup.js';
import path from 'path';
import fs from 'fs/promises';
import config from '../config/index.js';
import { activeFfmpegJobs } from '../services/fingerprintPipeline.js';
import { deleteProcessingJobs, cleanupScanningJobs } from '../services/cleanupService.js';

const router = express.Router();

// Get all processing job IDs (optionally filtered by status)
router.get('/jobs/ids', async (req, res) => {
  try {
    const db = req.app.get('db');
    const { status } = req.query;
    let jobs;
    if (status && status !== 'all') {
      jobs = getProcessingJobs(db, { status });
    } else {
      jobs = getProcessingJobs(db);
    }
    const ids = jobs.map((job) => job.id);
    res.json({ ids });
  } catch (error) {
    console.error('Failed to fetch job IDs from DB:', error);
    res.status(500).json({ error: 'Failed to fetch job IDs from DB' });
  }
});

// Get all processing jobs with optional filtering
router.get('/jobs', async (req, res) => {
  try {
    const db = req.app.get('db');
    const { status } = req.query;
    let jobs;
    if (status && status !== 'all') {
      jobs = getProcessingJobs(db, { status });
    } else {
      jobs = getProcessingJobs(db);
    }
    res.json({ jobs, total: jobs.length });
  } catch (error) {
    console.error('Failed to fetch jobs from DB:', error);
    res.status(500).json({ error: 'Failed to fetch jobs from DB' });
  }
});

// Get specific processing job by ID
router.get('/jobs/:id', async (req, res) => {
  try {
    const queue = queues['episode-processing'];
    const jobId = req.params.id;
    const allStates = [
      'active',
      'waiting',
      'completed',
      'failed',
      'delayed',
      'paused',
      'waiting-children',
      'repeat',
      'scheduled',
    ];
    // Try to find by dbJobId (custom data) or BullMQ jobId
    let job = await queue.getJob(jobId);
    if (!job) {
      // Try to find by dbJobId in job.data
      const jobs = await queue.getJobs(allStates, 0, 10000);
      job = jobs.find((j) => j.data && String(j.data.dbJobId) === String(jobId));
    }
    if (!job) {
      return res.status(404).json({ error: 'Processing job not found in Redis/BullMQ' });
    }
    res.json({
      job: {
        id: job.data && job.data.dbJobId ? job.data.dbJobId : job.id,
        status: job.finishedOn
          ? job.failedReason
            ? 'failed'
            : 'completed'
          : job.processedOn
            ? 'processing'
            : job.state || 'waiting',
        ...job.data,
        createdAt: job.timestamp,
        updatedAt: job.finishedOn || job.processedOn || job.timestamp,
      },
    });
  } catch (error) {
    console.error('Failed to fetch job from BullMQ:', error);
    res.status(500).json({ error: 'Failed to fetch job from BullMQ' });
  }
});

// Update processing job
router.put('/jobs/:id', (req, res) => {
  const db = req.app.get('db');
  const logger = req.app.get('logger');
  const jobId = parseInt(req.params.id);
  const updateData = req.body;

  if (isNaN(jobId)) {
    return res.status(400).json({ error: 'Invalid job ID' });
  }

  try {
    const updatedJob = updateProcessingJob(db, jobId, updateData);
    res.json({ success: true, job: updatedJob });
  } catch (error) {
    logger.error('Failed to update processing job:', error);
    res.status(500).json({ error: 'Failed to update processing job' });
  }
});

// Delete processing job
router.delete('/jobs/:id', async (req, res) => {
  const jobIdParam = req.params.id;
  try {
    const jobId = await enqueueCleanupJob('deleteProcessingJobs', { jobIds: [jobIdParam] });
    res.json({ success: true, cleanupJobId: jobId });
  } catch (error) {
    console.error('Failed to enqueue processing job deletion:', error);
    res.status(500).json({ error: 'Failed to enqueue processing job deletion' });
  }
});

// Get processing job statistics
router.get('/stats', (req, res) => {
  const db = req.app.get('db');
  const logger = req.app.get('logger');

  try {
    const stats = getProcessingJobStats(db);
    res.json(stats);
  } catch (error) {
    logger.error('Failed to fetch processing stats:', error);
    res.status(500).json({ error: 'Failed to fetch processing stats' });
  }
});

// Get queue status
router.get('/queue/status', async (req, res) => {
  const logger = req.app.get('logger');

  try {
    const queueStatus = await getQueueStatus();
    res.json({ queues: queueStatus });
  } catch (error) {
    logger.error('Failed to fetch queue status:', error);
    res.status(500).json({ error: 'Failed to fetch queue status' });
  }
});

// Get real-time processing status
router.get('/status', async (req, res) => {
  const db = req.app.get('db');
  const logger = req.app.get('logger');

  try {
    const [dbStats, queueStatusObj] = await Promise.all([
      getProcessingJobStats(db),
      getQueueStatus(),
    ]);

    const queueList = Object.values(queueStatusObj);

    const totalActive = queueList.reduce((sum, queue) => sum + queue.active, 0);
    const totalWaiting = queueList.reduce((sum, queue) => sum + queue.waiting, 0);

    res.json({
      database: dbStats,
      queues: queueStatusObj,
      summary: {
        totalActive,
        totalWaiting,
        totalCompleted: dbStats.byStatus.completed || 0,
        totalFailed: dbStats.byStatus.failed || 0,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to fetch processing status:', error);
    res.status(500).json({ error: 'Failed to fetch processing status' });
  }
});

// Debug endpoint to check queue state
router.get('/debug/queue-state', (req, res) => {
  const logger = req.app.get('logger');

  try {
    const debugState = debugQueueState();
    logger.info('Queue debug state requested:', debugState);
    res.json(debugState);
  } catch (error) {
    logger.error('Failed to get queue debug state:', error);
    res.status(500).json({ error: 'Failed to get queue debug state', details: error.message });
  }
});

// GET /api/processing/media-files
router.get('/media-files', async (req, res) => {
  try {
    const db = await getDatabaseSingleton();
    // Get all processing jobs (limit 500 for now)
    const jobs = getProcessingJobs(db, { limit: 500 });
    // Map to media file info
    const files = jobs.map((job) => ({
      id: job.media_file_id,
      file_name: job.file_path ? job.file_path.split('/').pop() : '',
      file_path: job.file_path,
      file_size: job.size,
      duration: null, // Not available yet
      series_name: job.show_title,
      season: job.season_number,
      episode: job.episode_number,
      episode_id: job.episode_id,
      created_date: job.created_date,
      updated_date: job.updated_date,
    }));
    res.json({ files });
  } catch (error) {
    console.error('Failed to fetch processing media files:', error);
    res.status(500).json({ error: 'Failed to fetch processing media files' });
  }
});

// Bulk delete jobs endpoint
router.post('/jobs/bulk-delete', async (req, res) => {
  const db = req.app.get('db');
  const logger = req.app.get('logger');
  const { jobIds, all } = req.body;
  try {
    let cleanupJobId;
    if (all) {
      // Enqueue a cleanup job with { all: true } for the worker to resolve job IDs
      cleanupJobId = await enqueueCleanupJob('deleteProcessingJobs', { all: true });
    } else if (Array.isArray(jobIds) && jobIds.length > 0) {
      cleanupJobId = await enqueueCleanupJob('deleteProcessingJobs', { jobIds });
    } else {
      return res.status(400).json({ error: 'No job IDs provided' });
    }
    res.json({ success: true, cleanupJobId });
  } catch (error) {
    console.error('Failed to enqueue bulk processing job deletion:', error);
    res.status(500).json({ error: 'Failed to enqueue bulk processing job deletion' });
  }
});

// Background temp file cleanup endpoint
router.post('/cleanup-temp-files', (req, res) => {
  const logger = req.app.get('logger');
  const audioDir = path.join(config.tempDir, 'audio');
  const trimmedDir = path.join(config.tempDir, 'trimmed');

  async function cleanupDir(dir) {
    try {
      const files = await fs.readdir(dir);
      await Promise.all(files.map((file) => fs.unlink(path.join(dir, file)).catch(() => {})));
      logger.info({ dir, count: files.length }, 'Temp files cleaned up');
    } catch (err) {
      logger.warn({ dir, error: err.message }, 'Failed to clean temp files');
    }
  }

  // Run cleanup in background
  setImmediate(() => {
    cleanupDir(audioDir);
    cleanupDir(trimmedDir);
  });

  res.json({ success: true, message: 'Temp file cleanup started' });
});

// Helper function to pause all workers
async function pauseAllWorkers() {
  try {
    const { pauseCpuWorkers, pauseGpuWorkers } = await import('../services/queue.js');
    await pauseCpuWorkers();
    await pauseGpuWorkers();
  } catch (error) {
    console.error('Failed to pause workers:', error);
  }
}

// Helper function to resume all workers
async function resumeAllWorkers() {
  try {
    const { resumeCpuWorkers, resumeGpuWorkers } = await import('../services/queue.js');
    await resumeCpuWorkers();
    await resumeGpuWorkers();
  } catch (error) {
    console.error('Failed to resume workers:', error);
  }
}

// GET /api/processing/active-ffmpeg
router.get('/active-ffmpeg', (req, res) => {
  res.json({ active: activeFfmpegJobs });
});

// Utility endpoint: Cleanup jobs for given show IDs
router.post('/cleanup-jobs-for-shows', async (req, res) => {
  const db = req.app.get('db');
  const logger = req.app.get('logger');
  const { showIds } = req.body;

  if (!Array.isArray(showIds) || showIds.length === 0) {
    return res.status(400).json({ error: 'showIds must be a non-empty array' });
  }

  try {
    // Get all episode file IDs and job IDs for these shows
    const episodeFileAndJobIds = getEpisodeFileIdAndJobIdForShows(db, showIds);
    const jobIds = episodeFileAndJobIds
      .map((e) => e.dbJobId)
      .filter((id) => id !== null && id !== undefined);
    logger.info(
      `Cleaning up jobs for shows: ${showIds.join(', ')}. Found job IDs: ${jobIds.join(', ')}`,
    );

    const queue = queues['episode-processing'];
    let deletedCount = 0;
    const failed = [];

    for (const jobId of jobIds) {
      try {
        // Remove from BullMQ/Redis (robust logic)
        let job = await queue.getJob(jobId);
        if (!job) {
          const jobs = await queue.getJobs(
            ['active', 'waiting', 'completed', 'failed', 'delayed'],
            0,
            10000,
          );
          job = jobs.find((j) => j.data && String(j.data.dbJobId) === String(jobId));
        }
        if (job) {
          await job.remove();
        }
        // Remove from SQL DB (if exists)
        const jobIdInt = parseInt(jobId);
        if (!isNaN(jobIdInt)) {
          const jobDb = getProcessingJobById(db, jobIdInt);
          if (jobDb) {
            // Clean up temp files (audio and trimmed)
            const tempFiles = [];
            if (jobDb.file_path) {
              const audioFileName =
                path.basename(jobDb.file_path, path.extname(jobDb.file_path)) + '.wav';
              const audioPath = path.join(config.tempDir, 'audio', audioFileName);
              tempFiles.push(audioPath);
              tempFiles.push(
                path.join(config.tempDir, 'trimmed', `intro_${jobIdInt}.mp4`),
                path.join(config.tempDir, 'trimmed', `credits_${jobIdInt}.mp4`),
              );
            }
            for (const file of tempFiles) {
              try {
                await fs.unlink(file);
                logger.info({ file }, 'Deleted temp file on job deletion');
              } catch (err) {
                if (err.code !== 'ENOENT') {
                  logger.warn(
                    { file, error: err.message },
                    'Failed to delete temp file on job deletion',
                  );
                }
              }
            }
            deleteProcessingJob(db, jobIdInt);
          }
        }
        deletedCount++;
      } catch (err) {
        failed.push(jobId);
        logger.error(`Failed to delete job ${jobId}: ${err && err.message}`);
      }
    }
    res.json({ success: true, showIds, deletedCount, failed });
  } catch (error) {
    logger.error('Failed to cleanup jobs for shows:', error);
    res
      .status(500)
      .json({ error: 'Failed to cleanup jobs for shows', details: error && error.message });
  }
});

// Add cleanup scanning jobs endpoint
router.post('/cleanup-scanning-jobs', async (req, res) => {
  try {
    const db = req.app.get('db');
    console.log('[API] Cleanup scanning jobs endpoint called');

    const result = await cleanupScanningJobs(db);

    if (result.success) {
      res.json({
        success: true,
        deletedCount: result.deletedCount,
        message: `Successfully deleted ${result.deletedCount} scanning jobs`,
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Failed to cleanup scanning jobs',
      });
    }
  } catch (error) {
    console.error('[API] Error in cleanup scanning jobs:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error during cleanup',
    });
  }
});

// Get cleanup job status by job ID
router.get('/cleanup-job-status/:id', async (req, res) => {
  try {
    const { Queue } = await import('bullmq');
    const cleanupQueue = new Queue('cleanup', { connection: { host: 'localhost', port: 6379 } });
    const job = await cleanupQueue.getJob(req.params.id);
    if (!job) {
      return res.status(404).json({ error: 'Cleanup job not found' });
    }
    const state = await job.getState();
    const progress = job.progress;
    const result = job.returnvalue;
    res.json({ id: job.id, state, progress, result, failedReason: job.failedReason });
  } catch (error) {
    // Don't log 404s as they're expected when cleanup jobs are completed and removed
    if (error.message && (error.message.includes('not found') || error.message.includes('404'))) {
      return res.status(404).json({ error: 'Cleanup job not found' });
    }
    // Don't log any errors for cleanup job status as they're expected
    return res.status(404).json({ error: 'Cleanup job not found' });
  }
});

export default router;
