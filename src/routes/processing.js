// API routes for managing processing jobs including listing, updating, and status management.
// Provides endpoints for processing job data retrieval and manipulation.

import express from 'express';
import {
  getProcessingJobs,
  updateProcessingJob,
  getProcessingJobById,
  getProcessingJobStats,
} from '../database/Db_Operations.js';
import { getQueueStatus, debugQueueState } from '../services/queue.js';

const router = express.Router();

// Get all processing jobs with optional filtering
router.get('/jobs', (req, res) => {
  const db = req.app.get('db');
  const logger = req.app.get('logger');
  const { sortBy = '-created_date', limit = 100, status } = req.query;

  try {
    const jobs = getProcessingJobs(db, { sortBy, limit: parseInt(limit), status });
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

export default router;
