// BullMQ-based job queue system for processing shows
// Handles job orchestration, scaling, and progress tracking
import { logger } from './logger.js';
import { getDb, getSetting, getProcessingJobById, getEpisodeFileById } from '../database/Db_Operations.js';
import { broadcastJobUpdate, broadcastQueueStatus } from './websocket.js';
import {
  processShowJob,
  extractAudioFromFile,
  generateAudioFingerprint,
  detectAudioSegments,
  processEpisodeFile,
} from './processors/showProcessor.js';
import { exec } from 'child_process';
import { promisify } from 'util';

// Import BullMQ using dynamic import to avoid ESM issues
let Queue, Worker;

// Initialize BullMQ imports
async function initBullMQ() {
  if (!Queue) {
    const bullmq = await import('bullmq');
    Queue = bullmq.Queue;
    Worker = bullmq.Worker;
  }
}

import Redis from 'ioredis';

// Redis connection
const redis = new Redis({
  host: 'localhost',
  port: 6379,
  maxRetriesPerRequest: null,
  retryDelayOnFailover: 100,
  enableReadyCheck: false,
});

// Get worker limits from settings
async function getWorkerLimits() {
  const db = await getDb();
  return {
    cpu: parseInt(getSetting(db, 'cpu_worker_limit', '2'), 10),
    gpu: parseInt(getSetting(db, 'gpu_worker_limit', '1'), 10),
  };
}

// Queue configuration - will be updated dynamically
let QUEUE_CONFIG = {};

// Update queue configuration based on current settings
async function updateQueueConfig() {
  const limits = await getWorkerLimits();

  // Log the worker limits being used
  logger.info('Worker limits from DB:', limits);

  QUEUE_CONFIG = {
    episodeProcessing: {
      name: 'episode-processing',
      concurrency: limits.cpu, // Allow up to N episodes in parallel
      retries: 3,
      backoff: 5000,
      timeout: 300000, // 5 minutes timeout
    },
    audioExtraction: {
      name: 'audio-extraction',
      concurrency: limits.cpu, // CPU-intensive
      retries: 2,
      backoff: 3000,
      timeout: 120000, // 2 minutes timeout
    },
    fingerprinting: {
      name: 'fingerprinting',
      concurrency: limits.cpu, // CPU-intensive
      retries: 2,
      backoff: 2000,
      timeout: 180000, // 3 minutes timeout
    },
    detection: {
      name: 'detection',
      concurrency: Math.min(limits.cpu, 4), // CPU-intensive but can be limited
      retries: 1,
      backoff: 1000,
      timeout: 60000, // 1 minute timeout
    },
    trimming: {
      name: 'trimming',
      concurrency: limits.gpu, // GPU-accelerated when available
      retries: 1,
      backoff: 1000,
      timeout: 120000, // 2 minutes timeout
    },
  };

  logger.info('Queue configuration updated:', QUEUE_CONFIG);
}

// Queue instances
const queues = {};
const workers = {};

// Initialize all queues
export async function initializeQueues() {
  logger.info('Starting queue initialization...');

  try {
    await initBullMQ();
    logger.info('BullMQ imports initialized successfully');

    // Update queue configuration from settings
    await updateQueueConfig();

    for (const [name, config] of Object.entries(QUEUE_CONFIG)) {
      logger.info(`Initializing queue: ${config.name}`);
      const queue = new Queue(config.name, { connection: redis });
      queues[config.name] = queue;
      logger.info(`Queue ${config.name} initialized successfully`);
    }

    logger.info('All queues initialized successfully. Queue count:', Object.keys(queues).length);
  } catch (error) {
    logger.error('Failed to initialize queues:', error);
    throw error;
  }
}

// Start all workers
export async function startQueues() {
  logger.info('Starting queue workers...');

  try {
    await initBullMQ();
    logger.info('BullMQ imports verified for worker startup');

    // Update queue configuration from settings
    await updateQueueConfig();

    for (const [name, config] of Object.entries(QUEUE_CONFIG)) {
      logger.info(`Starting worker for queue: ${config.name} with concurrency ${config.concurrency}`);

      const worker = new Worker(config.name, async (job) => {
        try {
          // Update job progress periodically
          const progressInterval = setInterval(() => {
            job.updateProgress(50); // Keep job alive
          }, 30000); // Every 30 seconds

          try {
            const result = await processJob(job.name, job);
            clearInterval(progressInterval);
            return result;
          } catch (error) {
            clearInterval(progressInterval);
            throw error;
          }
        } catch (error) {
          logger.error({ jobId: job.id, queue: name, error: error.message }, 'Job failed');
          throw error;
        }
      }, {
        connection: redis,
        concurrency: config.concurrency,
        stalledInterval: 60000, // Check for stalled jobs every minute
        maxStalledCount: 2, // Allow 2 stalls before failing
      });

      logger.info(`Worker instance created for ${name} with concurrency: ${config.concurrency}`);

      setupWorkerEvents(worker, name);
      workers[name] = worker;

      logger.info(`Worker for ${name} started successfully with concurrency ${config.concurrency}`);
    }

    logger.info('All workers started successfully. Worker count:', Object.keys(workers).length);
  } catch (error) {
    logger.error('Failed to start queue workers:', error);
    throw error;
  }
}

// Stop all queues
export async function stopQueues() {
  for (const [name, worker] of Object.entries(workers)) {
    await worker.close();
    logger.info(`Worker ${name} stopped`);
  }

  await redis.quit();
  logger.info('All queues stopped');
}

// Update worker limits and restart workers with new settings
export async function updateWorkerLimits() {
  logger.info('Updating worker limits from settings...');

  try {
    // Stop existing workers
    for (const [name, worker] of Object.entries(workers)) {
      await worker.close();
      logger.info(`Worker ${name} stopped for reconfiguration`);
    }

    // Clear workers object
    Object.keys(workers).forEach((key) => delete workers[key]);

    // Update queue configuration
    await updateQueueConfig();

    // Restart workers with new settings
    await startQueues();

    logger.info('Worker limits updated and workers restarted successfully');
  } catch (error) {
    logger.error('Failed to update worker limits:', error);
    throw error;
  }
}

// Setup worker event handlers
function setupWorkerEvents(worker, workerName) {
  worker.on('completed', (job, result) => {
    // Broadcast job completion
    broadcastJobUpdate({
      jobId: job.id,
      status: 'completed',
      worker: workerName,
      result,
    });

    // Broadcast updated queue status
    getQueueStatus().then((status) => {
      broadcastQueueStatus({ queues: status });
    });
  });

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job.id, worker: workerName, error: err.message }, 'Job failed');

    // Broadcast job failure
    broadcastJobUpdate({
      jobId: job.id,
      status: 'failed',
      worker: workerName,
      error: err.message,
    });

    // Broadcast updated queue status
    getQueueStatus().then((status) => {
      broadcastQueueStatus({ queues: status });
    });
  });

  worker.on('error', (err) => {
    logger.error({ worker: workerName, error: err.message }, 'Worker error');

    // Broadcast worker error
    broadcastJobUpdate({
      status: 'error',
      worker: workerName,
      error: err.message,
    });
  });
}

// Process different job types
async function processJob(jobType, jobOrData) {
  switch (jobType) {
    case 'episode-processing': {
      const db = await getDb();
      const episodeFileId = jobOrData.data.episodeFileId;
      // Fetch the episode file record by its ID
      const file = await getEpisodeFileById(db, episodeFileId);
      if (!file) {
        logger.error(`Episode file not found for ID: ${episodeFileId}`);
        throw new Error(`Episode file not found for ID: ${episodeFileId}`);
      }
      return await processEpisodeFile(jobOrData.id, file);
    }
    case 'audio-extraction':
      return await processAudioExtraction(jobOrData);
    case 'fingerprinting':
      return await processFingerprinting(jobOrData);
    case 'detection':
      return await processDetection(jobOrData);
    case 'trimming':
      return await processTrimming(jobOrData);
    default:
      throw new Error(`Unknown job type: ${jobType}`);
  }
}

// Placeholder worker functions
async function processAudioExtraction(jobData) {
  logger.info({ jobData }, 'Processing audio extraction');
  // Use the real audio extraction logic
  const audioPath = await extractAudioFromFile(jobData.filePath);
  return { message: 'Audio extracted successfully', audioPath };
}

async function processFingerprinting(jobData) {
  logger.info({ jobData }, 'Processing fingerprinting');
  // Use the real fingerprinting logic
  const fingerprint = await generateAudioFingerprint(jobData.audioPath);
  return { message: 'Fingerprint generated', fingerprint };
}

async function processDetection(jobData) {
  logger.info({ jobData }, 'Processing detection');
  // Use the real detection logic
  const segments = await detectAudioSegments(jobData.fingerprint, jobData.audioPath);
  return { message: 'Segments detected', segments };
}

async function processTrimming(jobData) {
  logger.info({ jobData }, 'Processing trimming');
  // Simulate trimming
  await new Promise((resolve) => setTimeout(resolve, 3000));
  return { message: 'Video trimmed successfully', clips: 3 };
}

// Enqueue a show processing job
export async function enqueueEpisodeProcessing(episodeFileIds) {
  await ensureQueuesInitialized();
  const queue = queues['episode-processing'];
  if (!queue) {
    const debugState = debugQueueState();
    logger.error('Episode processing queue not found. Debug state:', debugState);
    throw new Error('Episode processing queue not initialized');
  }
  logger.info('enqueueEpisodeProcessing called with episodeFileIds:', episodeFileIds);
  const jobIds = [];
  for (const episodeFileId of episodeFileIds) {
    if (!episodeFileId) {
      logger.warn('Skipping invalid episodeFileId:', episodeFileId);
      continue;
    }
    const job = await queue.add('episode-processing', { episodeFileId }, {
      priority: 10,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
    });
    jobIds.push(job.id);
  }
  return jobIds;
}

// Enqueue audio extraction job
export async function enqueueAudioExtraction(jobData) {
  const queue = queues['audio-extraction'];
  if (!queue) {
    throw new Error('Audio extraction queue not initialized');
  }

  const job = await queue.add('audio-extraction', jobData, {
    priority: 5,
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 3000,
    },
  });

  logger.info({ jobId: job.id, jobData }, 'Audio extraction job enqueued');
  return job.id;
}

// Enqueue fingerprinting job
export async function enqueueFingerprinting(jobData) {
  const queue = queues['fingerprinting'];
  if (!queue) {
    throw new Error('Fingerprinting queue not initialized');
  }

  const job = await queue.add('fingerprinting', jobData, {
    priority: 3,
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  });

  logger.info({ jobId: job.id, jobData }, 'Fingerprinting job enqueued');
  return job.id;
}

// Enqueue detection job
export async function enqueueDetection(jobData) {
  const queue = queues['detection'];
  if (!queue) {
    throw new Error('Detection queue not initialized');
  }

  const job = await queue.add('detection', jobData, {
    priority: 2,
    attempts: 1,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
  });

  logger.info({ jobId: job.id, jobData }, 'Detection job enqueued');
  return job.id;
}

// Enqueue trimming job
export async function enqueueTrimming(jobData) {
  const queue = queues['trimming'];
  if (!queue) {
    throw new Error('Trimming queue not initialized');
  }

  const job = await queue.add('trimming', jobData, {
    priority: 1,
    attempts: 1,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
  });

  logger.info({ jobId: job.id, jobData }, 'Trimming job enqueued');
  return job.id;
}

// Get queue status
export async function getQueueStatus() {
  const status = {};
  for (const [name, queue] of Object.entries(queues)) {
    const [waiting, active, completed, failed] = await Promise.all([
      queue.getWaiting(),
      queue.getActive(),
      queue.getCompleted(),
      queue.getFailed(),
    ]);

    status[name] = {
      name,
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
    };
  }
  return status;
}

// Get specific queue
export function getQueue(name) {
  return queues[name];
}

// Debug function to check queue state
export function debugQueueState() {
  return {
    queues: Object.keys(queues),
    workers: Object.keys(workers),
    queueCount: Object.keys(queues).length,
    workerCount: Object.keys(workers).length,
    showProcessingQueue: !!queues['episode-processing'],
  };
}

// Ensure queues are initialized before use
async function ensureQueuesInitialized() {
  logger.info('Checking queue initialization state...');
  logger.info('Current queues object:', queues);
  logger.info('Current workers object:', workers);
  logger.info('Queues object keys:', Object.keys(queues));
  logger.info('Queues object length:', Object.keys(queues).length);

  // Check if the episode-processing queue specifically exists
  if (!queues['episode-processing']) {
    logger.warn('Episode processing queue not found, attempting to initialize queues...');
    try {
      await initializeQueues();
      await startQueues();
      logger.info('Queues initialized successfully in ensureQueuesInitialized');
    } catch (error) {
      logger.error('Failed to initialize queues in ensureQueuesInitialized:', error);
      throw error;
    }
  } else {
    logger.info('Episode processing queue already exists');
  }
}

// Pause/resume logic for CPU and GPU workers
export async function pauseCpuWorkers() {
  for (const [name, worker] of Object.entries(workers)) {
    if (['audio-extraction', 'fingerprinting', 'detection', 'episode-processing'].includes(name)) {
      if (worker && typeof worker.pause === 'function') {
        await worker.pause(true); // true = do not process active jobs
        logger.info(`CPU worker ${name} paused`);
      }
    }
  }
}

export async function resumeCpuWorkers() {
  for (const [name, worker] of Object.entries(workers)) {
    if (['audio-extraction', 'fingerprinting', 'detection', 'episode-processing'].includes(name)) {
      if (worker && typeof worker.resume === 'function') {
        await worker.resume();
        logger.info(`CPU worker ${name} resumed`);
      }
    }
  }
}

export async function pauseGpuWorkers() {
  for (const [name, worker] of Object.entries(workers)) {
    if (['trimming'].includes(name)) {
      if (worker && typeof worker.pause === 'function') {
        await worker.pause(true);
        logger.info(`GPU worker ${name} paused`);
      }
    }
  }
}

export async function resumeGpuWorkers() {
  for (const [name, worker] of Object.entries(workers)) {
    if (['trimming'].includes(name)) {
      if (worker && typeof worker.resume === 'function') {
        await worker.resume();
        logger.info(`GPU worker ${name} resumed`);
      }
    }
  }
}

// Regularly clean BullMQ queues to prevent buildup of completed/failed jobs
export async function cleanAllQueues() {
  await initBullMQ();
  for (const queue of Object.values(queues)) {
    try {
      // Remove completed jobs older than 1 minute
      await queue.clean(60 * 1000, 'completed');
      // Remove failed jobs older than 1 minute
      await queue.clean(60 * 1000, 'failed');
      // Optionally, obliterate queue if needed (use with caution)
      // await queue.obliterate({ force: true });
    } catch (err) {
      logger.warn({ queue: queue.name, error: err.message }, 'Failed to clean BullMQ queue');
    }
  }
}

// After job deletion, clean queues
export async function removeJobFromAllQueues(jobId) {
  await initBullMQ();
  let removed = false;

  // First, kill any associated processes immediately
  await killJobProcesses(jobId);

  for (const [queueName, queue] of Object.entries(queues)) {
    try {
      const job = await queue.getJob(jobId);
      if (job) {
        // Check if job is currently active (being processed)
        const isActive = job.processedOn !== undefined && job.finishedOn === undefined;

        if (isActive) {
          // For active jobs, we need to be more aggressive
          logger.info({ jobId, queue: queueName }, 'Removing active job - this may take a moment');

          // Pause the worker FIRST to stop it from processing more jobs
          const worker = workers[queueName];
          if (worker && typeof worker.pause === 'function') {
            await worker.pause(true); // true = do not process active jobs
            logger.info({ jobId, queue: queueName }, 'Paused worker to stop job processing');
          }

          // Kill processes again after pausing
          await killJobProcesses(jobId);

          // Remove from Redis directly to ensure it's gone
          const redisClient = queue.client;
          const jobKey = `bull:${queueName}:${jobId}`;
          const activeKey = `bull:${queueName}:active`;
          const processedKey = `bull:${queueName}:processed`;
          const failedKey = `bull:${queueName}:failed`;
          const delayedKey = `bull:${queueName}:delayed`;
          const waitingKey = `bull:${queueName}:waiting`;

          // Remove job data from Redis completely
          await redisClient.del(jobKey);
          await redisClient.zrem(activeKey, jobId);
          await redisClient.zrem(processedKey, jobId);
          await redisClient.zrem(failedKey, jobId);
          await redisClient.zrem(delayedKey, jobId);
          await redisClient.zrem(waitingKey, jobId);

          // Also try to remove the job normally
          try {
            await job.remove();
          } catch (removeErr) {
            logger.warn({ jobId, queue: queueName, error: removeErr.message }, 'Normal job removal failed, but Redis cleanup succeeded');
          }

          // Resume the worker
          if (worker && typeof worker.resume === 'function') {
            await worker.resume();
            logger.info({ jobId, queue: queueName }, 'Resumed worker after job removal');
          }

          logger.info({ jobId, queue: queueName }, 'Active job forcefully removed from Redis');
        } else {
          // For non-active jobs, normal removal is fine
          await job.remove();
          logger.info({ jobId, queue: queueName }, 'Removed job from queue');
        }

        removed = true;
      }
    } catch (err) {
      logger.warn({ jobId, queue: queueName, error: err.message }, 'Failed to remove job from queue');
    }
  }

  // Clean queues after job removal
  await cleanAllQueues();
  return removed;
}

// Clear all jobs from all queues (one-time emergency stop)
export async function clearAllQueues() {
  await initBullMQ();
  logger.info('Clearing all jobs from all queues...');

  for (const [name, queue] of Object.entries(queues)) {
    try {
      // Get all jobs in the queue
      const waiting = await queue.getWaiting();
      const active = await queue.getActive();
      const delayed = await queue.getDelayed();

      // Remove all jobs
      for (const job of [...waiting, ...active, ...delayed]) {
        await job.remove();
      }

      logger.info({
        queue: name,
        waiting: waiting.length,
        active: active.length,
        delayed: delayed.length,
      }, 'Cleared all jobs from queue');

    } catch (err) {
      logger.error({ queue: name, error: err.message }, 'Failed to clear queue');
    }
  }

  logger.info('All queues cleared successfully');
}

const execAsync = promisify(exec);

// Kill any ffmpeg/fpcalc processes associated with a specific job
async function killJobProcesses(jobId) {
  try {
    // Kill any ffmpeg processes that might be running for this job
    await execAsync('pkill -9 -f "ffmpeg.*cliprr"');
    // Kill any fpcalc processes
    await execAsync('pkill -9 -f "fpcalc"');
    // Also kill any ffmpeg processes that might be extracting audio
    await execAsync('pkill -9 -f "ffmpeg.*-vn.*-acodec pcm_s16le"');
    // Kill any chunk extraction processes
    await execAsync('pkill -9 -f "ffmpeg.*-ss.*-t.*chunk_"');
    // Kill any ffmpeg processes that might be processing audio
    await execAsync('pkill -9 -f "ffmpeg.*audio"');
    // Kill any ffmpeg processes that might be processing video
    await execAsync('pkill -9 -f "ffmpeg.*video"');
    // Kill any ffmpeg processes that might be processing temp files
    await execAsync('pkill -9 -f "ffmpeg.*temp"');
    // Kill any ffmpeg processes that might be processing wav files
    await execAsync('pkill -9 -f "ffmpeg.*wav"');
    // Kill any ffmpeg processes that might be processing mp4 files
    await execAsync('pkill -9 -f "ffmpeg.*mp4"');

    logger.info({ jobId }, 'Killed all associated audio processing processes');
  } catch (error) {
    // It's okay if no processes were found to kill - don't log this as debug
    // logger.debug({ jobId, error: error.message }, 'No audio processes to kill');
  }
}

// Remove fingerprint data from database for a specific episode file
async function removeFingerprintData(episodeFileId) {
  try {
    const db = await getDb();

    // Remove from episode_fingerprints table
    const fingerprintResult = db.prepare(`
      DELETE FROM episode_fingerprints 
      WHERE episode_file_id = ?
    `).run(episodeFileId);

    // Remove from detection_results table
    const detectionResult = db.prepare(`
      DELETE FROM detection_results 
      WHERE episode_file_id = ?
    `).run(episodeFileId);

    if (fingerprintResult.changes > 0 || detectionResult.changes > 0) {
      logger.info({
        episodeFileId,
        fingerprintsRemoved: fingerprintResult.changes,
        detectionsRemoved: detectionResult.changes,
      }, 'Removed fingerprint data from database');
    }
  } catch (error) {
    logger.warn({ episodeFileId, error: error.message }, 'Failed to remove fingerprint data');
  }
}

// Remove detection results from database for a specific episode file (keep fingerprints)
async function removeDetectionData(episodeFileId) {
  try {
    const db = await getDb();

    // Only remove from detection_results table, keep fingerprints
    const detectionResult = db.prepare(`
      DELETE FROM detection_results 
      WHERE episode_file_id = ?
    `).run(episodeFileId);

    if (detectionResult.changes > 0) {
      logger.info({
        episodeFileId,
        detectionsRemoved: detectionResult.changes,
      }, 'Removed detection results from database (fingerprints preserved)');
    }
  } catch (error) {
    logger.warn({ episodeFileId, error: error.message }, 'Failed to remove detection data');
  }
}
