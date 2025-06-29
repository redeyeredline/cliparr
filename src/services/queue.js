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
    },
    audioExtraction: {
      name: 'audio-extraction',
      concurrency: limits.cpu, // CPU-intensive
      retries: 2,
      backoff: 3000,
    },
    fingerprinting: {
      name: 'fingerprinting',
      concurrency: limits.cpu, // CPU-intensive
      retries: 2,
      backoff: 2000,
    },
    detection: {
      name: 'detection',
      concurrency: Math.min(limits.cpu, 4), // CPU-intensive but can be limited
      retries: 1,
      backoff: 1000,
    },
    trimming: {
      name: 'trimming',
      concurrency: limits.gpu, // GPU-accelerated when available
      retries: 1,
      backoff: 1000,
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
          const result = await processJob(job.name, job);
          return result;
        } catch (error) {
          logger.error({ jobId: job.id, queue: name, error: error.message }, 'Job failed');
          throw error;
        }
      }, {
        connection: redis,
        concurrency: config.concurrency,
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
    logger.info({ jobId: job.id, episodeFileId }, 'Episode processing job enqueued');
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
  for (const queue of Object.values(queues)) {
    try {
      const job = await queue.getJob(jobId);
      if (job) {
        await job.remove();
        removed = true;
        logger.info({ jobId, queue: queue.name }, 'Removed job from queue');
      }
    } catch (err) {
      logger.warn({ jobId, queue: queue.name, error: err.message }, 'Failed to remove job from queue');
    }
  }
  // Clean queues after job removal
  await cleanAllQueues();
  return removed;
}
