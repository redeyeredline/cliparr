process.on('unhandledRejection', (reason, promise) => {

  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

console.log('Processing API loaded');
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
import { getQueueStatus, debugQueueState, removeJobFromAllQueues, queues } from '../services/queue.js';
import { getDatabaseSingleton } from '../database/Auto_DB_Setup.js';
import path from 'path';
import fs from 'fs/promises';
import config from '../config/index.js';
import { activeFfmpegJobs } from '../services/fingerprintPipeline.js';

const router = express.Router();

// Get all processing job IDs (optionally filtered by status)
router.get('/jobs/ids', (req, res) => {
  const db = req.app.get('db');
  const logger = req.app.get('logger');
  const { status } = req.query;

  try {
    let sql = 'SELECT id FROM processing_jobs';
    const params = [];
    if (status) {
      sql += ' WHERE status = ?';
      params.push(status);
    }
    const rows = db.prepare(sql).all(...params);
    const ids = rows.map((row) => row.id);
    res.json({ ids });
  } catch (error) {
    logger.error('Failed to fetch processing job IDs:', error);
    console.error('Failed to fetch processing job IDs:', error);
    res.status(500).json({ error: 'Failed to fetch processing job IDs' });
  }
});

// Get all processing jobs with optional filtering
router.get('/jobs', async (req, res) => {
  try {
    const queue = queues['episode-processing'];
    // Get jobs from BullMQ/Redis (adjust job types and range as needed)
    const jobs = await queue.getJobs(['active', 'waiting', 'completed', 'failed'], 0, 1000);
    res.json({ jobs, total: jobs.length });
  } catch (error) {
    console.error('Failed to fetch jobs from BullMQ:', error);
    res.status(500).json({ error: 'Failed to fetch jobs from BullMQ' });
  }
});

// Get specific processing job by ID
router.get('/jobs/:id', (req, res) => {
  const db = req.app.get('db');
  const logger = req.app.get('logger');
  const jobId = parseInt(req.params.id);

  if (isNaN(jobId)) {
    return res.status(400).json({ error: 'Invalid job ID' });
  }

  try {
    const job = getProcessingJobById(db, jobId);
    if (!job) {
      return res.status(404).json({ error: 'Processing job not found' });
    }
    res.json({ job });
  } catch (error) {
    logger.error('Failed to fetch processing job:', error);
    res.status(500).json({ error: 'Failed to fetch processing job' });
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
  const db = req.app.get('db');
  const logger = req.app.get('logger');
  const jobId = parseInt(req.params.id);

  if (isNaN(jobId)) {
    return res.status(400).json({ error: 'Invalid job ID' });
  }

  try {
    // Get job info before deleting
    const job = getProcessingJobById(db, jobId);
    if (!job) {
      return res.status(404).json({ error: 'Processing job not found' });
    }

    // Remove from BullMQ queues
    await removeJobFromAllQueues(jobId);

    // Clean up temp files (audio and trimmed)
    const tempFiles = [];
    if (job.file_path) {
      // Audio temp file
      const audioFileName = path.basename(job.file_path, path.extname(job.file_path)) + '.wav';
      const audioPath = path.join(config.tempDir, 'audio', audioFileName);
      tempFiles.push(audioPath);
      // Trimmed files (intro/credits)
      tempFiles.push(
        path.join(config.tempDir, 'trimmed', `intro_${jobId}.mp4`),
        path.join(config.tempDir, 'trimmed', `credits_${jobId}.mp4`),
      );
    }
    for (const file of tempFiles) {
      try {
        await fs.unlink(file);
        logger.info({ file }, 'Deleted temp file on job deletion');
      } catch (err) {
        // Ignore if file does not exist
        if (err.code !== 'ENOENT') {
          logger.warn({ file, error: err.message }, 'Failed to delete temp file on job deletion');
        }
      }
    }

    // Delete from DB
    const changes = deleteProcessingJob(db, jobId);
    if (changes === 0) {
      return res.status(404).json({ error: 'Processing job not found' });
    }
    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to delete processing job:', error);
    res.status(500).json({ error: 'Failed to delete processing job' });
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
    const [dbStats, queueStatus] = await Promise.all([
      getProcessingJobStats(db),
      getQueueStatus(),
    ]);

    const totalActive = queueStatus.reduce((sum, queue) => sum + queue.active, 0);
    const totalWaiting = queueStatus.reduce((sum, queue) => sum + queue.waiting, 0);

    res.json({
      database: dbStats,
      queues: queueStatus,
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
  // console.log('--- BULK DELETE ROUTE HIT ---', new Date().toISOString());
  try {
    const db = req.app.get('db');
    const logger = req.app.get('logger');
    const { jobIds, all } = req.body;
    logger.info('Bulk delete request body:', { jobIds, all });
    let deletedCount = 0;
    const failed = [];

    // Pause all workers first to prevent new jobs from starting
    logger.info('Pausing all workers before bulk delete');
    await pauseAllWorkers();

    if (all) {
      logger.info('Fetching all jobs for cleanup before DB delete');
      // Fetch all jobs with full details before deleting from DB
      const jobs = getProcessingJobs(db, { limit: 10000 });
      logger.info('Starting DB delete for all jobs');
      try {
        db.prepare('DELETE FROM processing_jobs').run();
        logger.info('All jobs deleted from DB');
      } catch (dbErr) {
        logger.error('DB error during bulk delete:', dbErr, typeof dbErr, JSON.stringify(dbErr));
        throw dbErr;
      }
      logger.info('Starting BullMQ and temp file cleanup for all jobs');
      for (const job of jobs) {
        try {
          await removeJobFromAllQueues(job.id);
          // Clean up temp files (audio and trimmed)
          const tempFiles = [];
          if (job.file_path) {
            const audioFileName = path.basename(job.file_path, path.extname(job.file_path)) + '.wav';
            const audioPath = path.join(config.tempDir, 'audio', audioFileName);
            tempFiles.push(audioPath);
            tempFiles.push(
              path.join(config.tempDir, 'trimmed', `intro_${job.id}.mp4`),
              path.join(config.tempDir, 'trimmed', `credits_${job.id}.mp4`),
            );
          }
          for (const file of tempFiles) {
            try {
              await fs.unlink(file);
              // logger.info({ file }, 'Deleted temp file on bulk job deletion');
            } catch (err) {
              if (err.code !== 'ENOENT') {
                logger.warn({ file, error: err.message }, 'Failed to delete temp file on bulk job deletion');
              }
            }
          }
        } catch (err) {
          failed.push(job.id);
        }
      }
      logger.info('Bulk delete all jobs complete');
      // Resume all workers
      logger.info('Resuming all workers after bulk delete');
      await resumeAllWorkers();
      return res.json({ success: true, all: true, deletedCount: jobs.length, failed });
    }
    if (!Array.isArray(jobIds) || jobIds.length === 0) {
      logger.warn('No job IDs provided for bulk delete');
      // Resume workers even if no jobs to delete
      await resumeAllWorkers();
      return res.status(400).json({ error: 'No job IDs provided' });
    }
    logger.info('Fetching selected jobs for cleanup before DB delete');
    // Fetch full job objects before deleting from DB
    const toDelete = jobIds.map((id) => parseInt(id)).filter((id) => !isNaN(id));
    if (toDelete.length === 0) {
      logger.warn('No valid job IDs to delete');
      // Resume workers even if no valid jobs to delete
      await resumeAllWorkers();
      return res.status(400).json({ error: 'No valid job IDs to delete' });
    }
    let jobs;
    try {
      jobs = db.prepare(`SELECT pj.*, ef.file_path FROM processing_jobs pj JOIN episode_files ef ON pj.media_file_id = ef.id WHERE pj.id IN (${toDelete.map(() => '?').join(',')})`).all(...toDelete);
      db.prepare(`DELETE FROM processing_jobs WHERE id IN (${toDelete.map(() => '?').join(',')})`).run(...toDelete);
    } catch (dbErr) {
      logger.error('DB error during selected jobs bulk delete:', dbErr, 'SQL:', `SELECT id FROM processing_jobs WHERE id IN (${toDelete.map(() => '?').join(',')})`, 'Params:', toDelete);
      // Resume workers even if DB error
      await resumeAllWorkers();
      throw dbErr;
    }
    deletedCount = jobs.length;
    logger.info('DB delete for selected jobs complete');
    // Remove from BullMQ and clean temp files
    for (const job of jobs) {
      try {
        await removeJobFromAllQueues(job.id);
        // Clean up temp files (audio and trimmed)
        const tempFiles = [];
        if (job.file_path) {
          const audioFileName = path.basename(job.file_path, path.extname(job.file_path)) + '.wav';
          const audioPath = path.join(config.tempDir, 'audio', audioFileName);
          tempFiles.push(audioPath);
          tempFiles.push(
            path.join(config.tempDir, 'trimmed', `intro_${job.id}.mp4`),
            path.join(config.tempDir, 'trimmed', `credits_${job.id}.mp4`),
          );
        }
        for (const file of tempFiles) {
          try {
            await fs.unlink(file);
            // logger.info({ file }, 'Deleted temp file on bulk job deletion');
          } catch (err) {
            if (err.code !== 'ENOENT') {
              logger.warn({ file, error: err.message }, 'Failed to delete temp file on bulk job deletion');
            }
          }
        }
      } catch (err) {
        failed.push(job.id);
      }
    }
    logger.info('Bulk delete for selected jobs complete');
    // Resume all workers
    logger.info('Resuming all workers after bulk delete');
    await resumeAllWorkers();
    res.json({ success: true, deletedCount, failed });
  } catch (err) {
    console.error('UNHANDLED ERROR in /jobs/bulk-delete:', err && (err.stack || err.message || err));
    // Resume workers even if error
    try {
      await resumeAllWorkers();
    } catch (resumeErr) {
      console.error('Failed to resume workers after error:', resumeErr);
    }
    res.status(500).json({ error: 'Unhandled error in /jobs/bulk-delete', details: err && (err.stack || err.message || err) });
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

export default router;
