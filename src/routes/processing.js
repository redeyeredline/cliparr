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
import { getQueueStatus, debugQueueState } from '../services/queue.js';
import { getDatabaseSingleton } from '../database/Auto_DB_Setup.js';

const router = express.Router();

// Get all processing job IDs (optionally filtered by status)
router.get('/jobs/ids', (req, res) => {
  console.log('PROCESSING /jobs/ids route hit');
  const db = req.app.get('db');
  const logger = req.app.get('logger');
  const { status } = req.query;

  // Debug: log the incoming query
  console.log('GET /jobs/ids query:', req.query);

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
router.get('/jobs', (req, res) => {
  const db = req.app.get('db');
  const logger = req.app.get('logger');
  const { sortBy = '-created_date', limit, status } = req.query;

  try {
    const jobs = getProcessingJobs(db, { sortBy, limit: limit ? parseInt(limit) : undefined, status });
    res.json({ jobs, total: jobs.length });
  } catch (error) {
    logger.error('Failed to fetch processing jobs:', error);
    res.status(500).json({ error: 'Failed to fetch processing jobs' });
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
router.delete('/jobs/:id', (req, res) => {
  const db = req.app.get('db');
  const logger = req.app.get('logger');
  const jobId = parseInt(req.params.id);

  if (isNaN(jobId)) {
    return res.status(400).json({ error: 'Invalid job ID' });
  }

  try {
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
    if (jobs.length > 0) {
      console.log('Sample job object:', jobs[0]);
    }
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

export default router;
