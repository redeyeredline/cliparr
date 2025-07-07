// BullMQ-based job queue system for processing shows
// Handles job orchestration, scaling, and progress tracking
import { workerLogger } from './logger.js';
import { getDb, getSetting, getEpisodeFileById } from '../database/Db_Operations.js';
import { broadcastJobUpdate, broadcastQueueStatus } from './websocket.js';
import {
  extractAudioFromFile,
  generateAudioFingerprint,
  detectAudioSegments,
  processEpisodeFile,
} from './processors/showProcessor.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import { Queue, Worker, QueueEvents } from 'bullmq';
import { deleteProcessingJobs, deleteShowsAndCleanup } from './cleanupService.js';
import Redis from 'ioredis';

// Override console.error to suppress "Missing key for job" errors from BullMQ
const originalConsoleError = console.error;
console.error = (...args) => {
  const message = args.join(' ');
  if (message.includes('Missing key for job')) {
    workerLogger.debug('Suppressed console.error (Missing key for job):', message);
    return;
  }
  originalConsoleError.apply(console, args);
};

// Global unhandled rejection handler to suppress "Missing key for job" errors
process.on('unhandledRejection', (reason, promise) => {
  if (reason && typeof reason === 'object' && reason.message && reason.message.includes('Missing key for job')) {
    workerLogger.debug('Suppressed unhandled rejection (Missing key for job):', reason.message);
    return;
  }
  // Let other unhandled rejections through
  workerLogger.error('Unhandled rejection:', reason);
});

// Global uncaught exception handler to suppress "Missing key for job" errors
process.on('uncaughtException', (error) => {
  if (error && error.message && error.message.includes('Missing key for job')) {
    workerLogger.debug('Suppressed uncaught exception (Missing key for job):', error.message);
    return;
  }
  // Let other uncaught exceptions through
  workerLogger.error('Uncaught exception:', error);
});

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
  try {
    const db = await getDb();
    return {
      cpu: parseInt(getSetting(db, 'cpu_worker_limit', '2'), 10),
      gpu: parseInt(getSetting(db, 'gpu_worker_limit', '1'), 10),
    };
  } catch (error) {
    workerLogger.warn('Failed to get worker limits from database, using defaults:', error.message);
    return {
      cpu: 2,
      gpu: 1,
    };
  }
}

// Queue configuration - will be updated dynamically
let QUEUE_CONFIG = {};

// Update queue configuration based on current settings
async function updateQueueConfig() {
  try {
    const limits = await getWorkerLimits();

    // Log the worker limits being used
    workerLogger.info('Worker limits from DB:', limits);

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

    workerLogger.info('Queue configuration updated:', QUEUE_CONFIG);
  } catch (error) {
    workerLogger.error('Failed to update queue configuration, using defaults:', error);
    // Fallback configuration
    QUEUE_CONFIG = {
      episodeProcessing: {
        name: 'episode-processing',
        concurrency: 2,
        retries: 3,
        backoff: 5000,
        timeout: 300000,
      },
      audioExtraction: {
        name: 'audio-extraction',
        concurrency: 2,
        retries: 2,
        backoff: 3000,
        timeout: 120000,
      },
      fingerprinting: {
        name: 'fingerprinting',
        concurrency: 2,
        retries: 2,
        backoff: 2000,
        timeout: 180000,
      },
      detection: {
        name: 'detection',
        concurrency: 2,
        retries: 1,
        backoff: 1000,
        timeout: 60000,
      },
      trimming: {
        name: 'trimming',
        concurrency: 1,
        retries: 1,
        backoff: 1000,
        timeout: 120000,
      },
    };
  }
}

// Queue instances
const queues = {};
const workers = {};

// After initializing queues, set up QueueEvents for progress broadcasting
let episodeProcessingQueueEvents;

// Initialize all queues
export async function initializeQueues() {
  workerLogger.info('Starting queue initialization...');

  try {
    // Test Redis connectivity first
    try {
      await redis.ping();
      workerLogger.info('Redis connection test successful');
    } catch (redisError) {
      workerLogger.error('Redis connection test failed:', redisError);
      throw new Error(`Redis connection failed: ${redisError.message}`);
    }

    await updateQueueConfig();

    const initializedQueues = [];
    for (const [_name, config] of Object.entries(QUEUE_CONFIG)) {
      try {
        workerLogger.info(`Initializing queue: ${config.name}`);
        const queue = new Queue(config.name, { connection: redis });
        queues[config.name] = queue;
        initializedQueues.push(config.name);
        workerLogger.info(`Queue ${config.name} initialized successfully`);
      } catch (error) {
        workerLogger.error(`Failed to initialize queue ${config.name}:`, error);
        // Continue with other queues instead of failing completely
      }
    }

    // NEW: Setup QueueEvents for episode-processing progress
    if (!episodeProcessingQueueEvents) {
      episodeProcessingQueueEvents = new QueueEvents('episode-processing', { connection: redis });
      episodeProcessingQueueEvents.on('progress', async ({ jobId, data }) => {
        workerLogger.info('[QueueEvents] Progress event:', { jobId, data });
        // Fetch the job to get dbJobId
        const queue = queues['episode-processing'];
        let dbJobId;
        if (queue) {
          try {
            const job = await queue.getJob(jobId);
            dbJobId = job?.data?.dbJobId;
            workerLogger.info({ jobId, dbJobId }, '[QueueEvents] Fetched job for progress event');
          } catch (err) {
            workerLogger.warn('Could not fetch job for dbJobId:', { jobId, err });
          }
        }
        workerLogger.info({ jobId, dbJobId, progress: data }, '[QueueEvents] Broadcasting job update');
        broadcastJobUpdate({
          type: 'job_update',
          jobId,
          dbJobId,
          progress: data,
          status: 'processing',
        });
      });
    }

    workerLogger.info(`Queue initialization completed. ${initializedQueues.length}/${Object.keys(QUEUE_CONFIG).length} queues initialized successfully.`);

    if (initializedQueues.length === 0) {
      throw new Error('No queues were initialized successfully');
    }
  } catch (error) {
    workerLogger.error('Failed to initialize queues:', error);
    throw error;
  }
}

// Start all workers
export async function startQueues() {
  workerLogger.info('Starting queue workers...');

  try {
    await updateQueueConfig();

    const startedWorkers = [];
    for (const [name, config] of Object.entries(QUEUE_CONFIG)) {
      try {
        workerLogger.info(`Starting worker for queue: ${config.name} with concurrency ${config.concurrency}`);

        const worker = new Worker(config.name, async (job) => {
          try {
            // Update job progress periodically
            const progressInterval = setInterval(async () => {
              workerLogger.info({ jobId: job.id, dbJobId: job.data?.dbJobId }, 'Calling job.updateProgress(50) as keep-alive');
              try {
                await job.updateProgress(50); // Keep job alive
              } catch (progressError) {
                // Suppress "Missing key for job" errors from updateProgress
                if (progressError.message && progressError.message.includes('Missing key for job')) {
                  workerLogger.debug({ jobId: job.id, error: progressError.message }, 'Suppressed updateProgress missing key error');
                  return;
                }
                // Re-throw other errors
                throw progressError;
              }
            }, 30000); // Every 30 seconds

            try {
              const result = await processJob(job.name, job);
              clearInterval(progressInterval);
              workerLogger.info({ jobId: job.id, dbJobId: job.data?.dbJobId, status: 'completed', result }, 'Job completed');
              return result;
            } catch (error) {
              clearInterval(progressInterval);
              workerLogger.info({ jobId: job.id, dbJobId: job.data?.dbJobId, status: 'failed', error: error.message }, 'Job failed');
              throw error;
            }
          } catch (error) {
            workerLogger.error({ jobId: job.id, queue: name, error: error.message }, 'Job failed');
            throw error;
          }
        }, {
          connection: redis,
          concurrency: config.concurrency,
          stalledInterval: 60000, // Check for stalled jobs every minute
          maxStalledCount: 2, // Allow 2 stalls before failing
        });

        workerLogger.info(`Worker instance created for ${name} with concurrency: ${config.concurrency}`);

        setupWorkerEvents(worker, name);
        workers[name] = worker;
        startedWorkers.push(name);

        workerLogger.info(`Worker for ${name} started successfully with concurrency ${config.concurrency}`);
      } catch (error) {
        workerLogger.error(`Failed to start worker for ${name}:`, error);
        // Continue with other workers instead of failing completely
      }
    }

    workerLogger.info(`Worker startup completed. ${startedWorkers.length}/${Object.keys(QUEUE_CONFIG).length} workers started successfully.`);

    if (startedWorkers.length === 0) {
      throw new Error('No workers were started successfully');
    }
  } catch (error) {
    workerLogger.error('Failed to start queue workers:', error);
    throw error;
  }
}

// Stop all queues
export async function stopQueues() {
  for (const [name, worker] of Object.entries(workers)) {
    await worker.close();
    workerLogger.info(`Worker ${name} stopped`);
  }

  await redis.quit();
  workerLogger.info('All queues stopped');
}

// Update worker limits and restart workers with new settings
export async function updateWorkerLimits() {
  workerLogger.info('Updating worker limits from settings...');

  try {
    // Stop existing workers
    for (const [name, worker] of Object.entries(workers)) {
      await worker.close();
      workerLogger.info(`Worker ${name} stopped for reconfiguration`);
    }

    // Clear workers object
    Object.keys(workers).forEach((key) => delete workers[key]);

    // Update queue configuration
    await updateQueueConfig();

    // Restart workers with new settings
    await startQueues();

    workerLogger.info('Worker limits updated and workers restarted successfully');
  } catch (error) {
    workerLogger.error('Failed to update worker limits:', error);
    throw error;
  }
}

// Setup worker event handlers
function setupWorkerEvents(worker, workerName) {
  worker.on('completed', (job, result) => {
    // Broadcast job completion
    workerLogger.info({ jobId: job.id, dbJobId: job.data?.dbJobId, status: 'completed', result }, 'Job completed');
    broadcastJobUpdate({
      type: 'job_update',
      jobId: job.id,
      dbJobId: job.data && job.data.dbJobId,
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
    // Suppress "Missing key for job" errors as they're harmless after delete all operations
    if (err.message && err.message.includes('Missing key for job')) {
      workerLogger.debug({ jobId: job?.id, worker: workerName, error: err.message }, 'Suppressed missing key error (harmless after delete all)');
      return;
    }

    workerLogger.error({ jobId: job.id, worker: workerName, error: err.message }, 'Job failed');

    // Broadcast job failure
    workerLogger.info({ jobId: job.id, dbJobId: job.data?.dbJobId, status: 'failed', error: err.message }, 'Job failed');
    broadcastJobUpdate({
      type: 'job_update',
      jobId: job.id,
      dbJobId: job.data && job.data.dbJobId,
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
    // Suppress "Missing key for job" errors as they're harmless after delete all operations
    if (err.message && err.message.includes('Missing key for job')) {
      workerLogger.debug({ worker: workerName, error: err.message }, 'Suppressed missing key error (harmless after delete all)');
      return;
    }

    workerLogger.error({ worker: workerName, error: err.message }, 'Worker error');

    // Broadcast worker error
    workerLogger.info({ worker: workerName, error: err.message }, 'Worker error');
    broadcastJobUpdate({
      type: 'job_update',
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
      const dbJobId = jobOrData.data.dbJobId;
      // Fetch the episode file record by its ID
      const file = await getEpisodeFileById(db, episodeFileId);
      if (!file) {
        workerLogger.error(`Episode file not found for ID: ${episodeFileId}`);
        throw new Error(`Episode file not found for ID: ${episodeFileId}`);
      }
      return await processEpisodeFile(jobOrData.id, file, dbJobId);
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
  workerLogger.info({ jobData }, 'Processing audio extraction');
  // Use the real audio extraction logic
  const audioPath = await extractAudioFromFile(jobData.filePath);
  return { message: 'Audio extracted successfully', audioPath };
}

async function processFingerprinting(jobData) {
  workerLogger.info({ jobData }, 'Processing fingerprinting');
  // Use the real fingerprinting logic
  const fingerprint = await generateAudioFingerprint(jobData.audioPath);
  return { message: 'Fingerprint generated', fingerprint };
}

async function processDetection(jobData) {
  workerLogger.info({ jobData }, 'Processing detection');
  // Use the real detection logic
  const segments = await detectAudioSegments(jobData.fingerprint, jobData.audioPath);
  return { message: 'Segments detected', segments };
}

async function processTrimming(jobData) {
  workerLogger.info({ jobData }, 'Processing trimming');
  // Simulate trimming
  await new Promise((resolve) => setTimeout(resolve, 3000));
  return { message: 'Video trimmed successfully', clips: 3 };
}

// Enqueue a show processing job
export async function enqueueEpisodeProcessing(episodeFileAndJobIds) {
  await ensureQueuesInitialized();
  const queue = queues['episode-processing'];
  if (!queue) {
    const debugState = debugQueueState();
    workerLogger.error('Episode processing queue not found. Debug state:', debugState);
    throw new Error('Episode processing queue not initialized');
  }

  // Validate input
  if (!Array.isArray(episodeFileAndJobIds)) {
    throw new Error('episodeFileAndJobIds must be an array');
  }

  workerLogger.info('enqueueEpisodeProcessing called with episodeFileAndJobIds:', episodeFileAndJobIds.map((e) => ({ ...e, dbJobIdType: typeof e.dbJobId, episodeFileIdType: typeof e.episodeFileId })));
  const jobIds = [];

  for (const { episodeFileId, dbJobId } of episodeFileAndJobIds) {
    workerLogger.info('Processing episode:', { episodeFileId, dbJobId, dbJobIdType: typeof dbJobId, episodeFileIdType: typeof episodeFileId });

    // Enhanced validation
    if (!episodeFileId || !dbJobId) {
      workerLogger.warn('Skipping invalid episodeFileId/dbJobId:', { episodeFileId, dbJobId });
      continue;
    }

    // Ensure both values are numbers or can be converted to numbers
    const numericEpisodeFileId = Number(episodeFileId);
    const numericDbJobId = Number(dbJobId);

    if (isNaN(numericEpisodeFileId) || isNaN(numericDbJobId)) {
      workerLogger.warn('Skipping non-numeric IDs:', { episodeFileId, dbJobId, numericEpisodeFileId, numericDbJobId });
      continue;
    }

    try {
      const jobData = {
        episodeFileId: numericEpisodeFileId,
        dbJobId: String(numericDbJobId),
      };
      const jobOpts = {
        jobId: `epjob-${numericDbJobId}`,
        priority: 10,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      };
      workerLogger.info('Adding job to queue:', { jobData, jobOpts });

      // dbJobId is required for all jobs
      const job = await queue.add('episode-processing', jobData, jobOpts);

      workerLogger.info('Job added successfully:', { jobId: job.id, originalDbJobId: dbJobId });
      jobIds.push(job.id);
    } catch (error) {
      let errorDetails = {};
      try {
        errorDetails = Object.getOwnPropertyNames(error).reduce((acc, key) => {
          acc[key] = error[key]; return acc;
        }, {});
      } catch (e) {}
      console.error('BULLMQ ERROR DETAILS:', {
        episodeFileId,
        dbJobId,
        numericEpisodeFileId,
        numericDbJobId,
        errorMessage: error.message,
        errorStack: error.stack,
        errorType: error.constructor ? error.constructor.name : undefined,
        errorDetails: JSON.stringify(errorDetails),
      });
      workerLogger.error('Failed to add job to queue:', {
        episodeFileId,
        dbJobId,
        numericEpisodeFileId,
        numericDbJobId,
        error: error.message,
        stack: error.stack,
        errorType: error.constructor ? error.constructor.name : undefined,
        errorDetails: JSON.stringify(errorDetails),
      });
      throw error;
    }
  }

  workerLogger.info('All jobs enqueued successfully:', { jobIds });
  return jobIds;
}

// Enqueue audio extraction job
export async function enqueueAudioExtraction(jobData) {
  const queue = queues['audio-extraction'];
  if (!queue) {
    throw new Error('Audio extraction queue not initialized');
  }
  if (!jobData.dbJobId) {
    throw new Error('dbJobId is required in jobData');
  }
  // dbJobId is required for all jobs
  const job = await queue.add('audio-extraction', jobData, {
    priority: 5,
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 3000,
    },
  });
  workerLogger.info({ jobId: job.id, jobData }, 'Audio extraction job enqueued');
  return job.id;
}

// Enqueue fingerprinting job
export async function enqueueFingerprinting(jobData) {
  const queue = queues['fingerprinting'];
  if (!queue) {
    throw new Error('Fingerprinting queue not initialized');
  }
  if (!jobData.dbJobId) {
    throw new Error('dbJobId is required in jobData');
  }
  // dbJobId is required for all jobs
  const job = await queue.add('fingerprinting', jobData, {
    priority: 3,
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  });
  workerLogger.info({ jobId: job.id, jobData }, 'Fingerprinting job enqueued');
  return job.id;
}

// Enqueue detection job
export async function enqueueDetection(jobData) {
  const queue = queues['detection'];
  if (!queue) {
    throw new Error('Detection queue not initialized');
  }
  if (!jobData.dbJobId) {
    throw new Error('dbJobId is required in jobData');
  }
  // dbJobId is required for all jobs
  const job = await queue.add('detection', jobData, {
    priority: 2,
    attempts: 1,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
  });
  workerLogger.info({ jobId: job.id, jobData }, 'Detection job enqueued');
  return job.id;
}

// Enqueue trimming job
export async function enqueueTrimming(jobData) {
  const queue = queues['trimming'];
  if (!queue) {
    throw new Error('Trimming queue not initialized');
  }
  if (!jobData.dbJobId) {
    throw new Error('dbJobId is required in jobData');
  }
  // dbJobId is required for all jobs
  const job = await queue.add('trimming', jobData, {
    priority: 1,
    attempts: 1,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
  });
  workerLogger.info({ jobId: job.id, jobData }, 'Trimming job enqueued');
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
  workerLogger.info('Checking queue initialization state...');
  workerLogger.info('Current queues object:', queues);
  workerLogger.info('Current workers object:', workers);
  workerLogger.info('Queues object keys:', Object.keys(queues));
  workerLogger.info('Queues object length:', Object.keys(queues).length);

  // Check if the episode-processing queue specifically exists
  if (!queues['episode-processing']) {
    workerLogger.warn('Episode processing queue not found, attempting to initialize queues...');
    try {
      await initializeQueues();
      await startQueues();
      workerLogger.info('Queues initialized successfully in ensureQueuesInitialized');
    } catch (error) {
      workerLogger.error('Failed to initialize queues in ensureQueuesInitialized:', error);
      throw error;
    }
  } else {
    workerLogger.info('Episode processing queue already exists');
  }
}

// Pause/resume logic for CPU and GPU workers
export async function pauseCpuWorkers() {
  for (const [name, worker] of Object.entries(workers)) {
    if (['audio-extraction', 'fingerprinting', 'detection', 'episode-processing'].includes(name)) {
      if (worker && typeof worker.pause === 'function') {
        await worker.pause(true); // true = do not process active jobs
        workerLogger.info(`CPU worker ${name} paused`);
      }
    }
  }
}

export async function resumeCpuWorkers() {
  for (const [name, worker] of Object.entries(workers)) {
    if (['audio-extraction', 'fingerprinting', 'detection', 'episode-processing'].includes(name)) {
      if (worker && typeof worker.resume === 'function') {
        await worker.resume();
        workerLogger.info(`CPU worker ${name} resumed`);
      }
    }
  }
}

export async function pauseGpuWorkers() {
  for (const [name, worker] of Object.entries(workers)) {
    if (['trimming'].includes(name)) {
      if (worker && typeof worker.pause === 'function') {
        await worker.pause(true);
        workerLogger.info(`GPU worker ${name} paused`);
      }
    }
  }
}

export async function resumeGpuWorkers() {
  for (const [name, worker] of Object.entries(workers)) {
    if (['trimming'].includes(name)) {
      if (worker && typeof worker.resume === 'function') {
        await worker.resume();
        workerLogger.info(`GPU worker ${name} resumed`);
      }
    }
  }
}

// Regularly clean BullMQ queues to prevent buildup of completed/failed jobs
export async function cleanAllQueues() {
  for (const queue of Object.values(queues)) {
    try {
      // Remove completed jobs older than 1 minute
      await queue.clean(60 * 1000, 'completed');
      // Remove failed jobs older than 1 minute
      await queue.clean(60 * 1000, 'failed');
      // Optionally, obliterate queue if needed (use with caution)
      // await queue.obliterate({ force: true });
    } catch (err) {
      workerLogger.warn({ queue: queue.name, error: err.message }, 'Failed to clean BullMQ queue');
    }
  }
}

// After job deletion, clean queues
export async function removeJobFromAllQueues(jobId) {
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
          workerLogger.info({ jobId, queue: queueName }, 'Removing active job - this may take a moment');

          // Pause the worker FIRST to stop it from processing more jobs
          const worker = workers[queueName];
          if (worker && typeof worker.pause === 'function') {
            await worker.pause(true); // true = do not process active jobs
            workerLogger.info({ jobId, queue: queueName }, 'Paused worker to stop job processing');
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
            workerLogger.warn({ jobId, queue: queueName, error: removeErr.message }, 'Normal job removal failed, but Redis cleanup succeeded');
          }

          // Resume the worker
          if (worker && typeof worker.resume === 'function') {
            await worker.resume();
            workerLogger.info({ jobId, queue: queueName }, 'Resumed worker after job removal');
          }

          workerLogger.info({ jobId, queue: queueName }, 'Active job forcefully removed from Redis');
        } else {
          // For non-active jobs, normal removal is fine
          await job.remove();
          workerLogger.info({ jobId, queue: queueName }, 'Removed job from queue');
        }

        removed = true;
      }
    } catch (err) {
      workerLogger.warn({ jobId, queue: queueName, error: err.message }, 'Failed to remove job from queue');
    }
  }

  // Clean queues after job removal
  await cleanAllQueues();
  return removed;
}

// Clear all jobs from all queues (one-time emergency stop)
export async function clearAllQueues() {
  workerLogger.info('Clearing all jobs from all queues...');

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

      workerLogger.info({
        queue: name,
        waiting: waiting.length,
        active: active.length,
        delayed: delayed.length,
      }, 'Cleared all jobs from queue');

    } catch (err) {
      workerLogger.error({ queue: name, error: err.message }, 'Failed to clear queue');
    }
  }

  workerLogger.info('All queues cleared successfully');
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

    workerLogger.info({ jobId }, 'Killed all associated audio processing processes');
  } catch (error) {
    // It's okay if no processes were found to kill - don't log this as debug
    // workerLogger.debug({ jobId, error: error.message }, 'No audio processes to kill');
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
      workerLogger.info({
        episodeFileId,
        fingerprintsRemoved: fingerprintResult.changes,
        detectionsRemoved: detectionResult.changes,
      }, 'Removed fingerprint data from database');
    }
  } catch (error) {
    workerLogger.warn({ episodeFileId, error: error.message }, 'Failed to remove fingerprint data');
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
      workerLogger.info({
        episodeFileId,
        detectionsRemoved: detectionResult.changes,
      }, 'Removed detection results from database (fingerprints preserved)');
    }
  } catch (error) {
    workerLogger.warn({ episodeFileId, error: error.message }, 'Failed to remove detection data');
  }
}

// --- Cleanup Queue and Worker ---
const cleanupQueue = new Queue('cleanup', { connection: redis });

const cleanupWorker = new Worker('cleanup', async (job) => {
  workerLogger.info({ jobId: job.id, name: job.name, data: job.data }, 'Cleanup worker started');
  if (job.name === 'deleteProcessingJobs') {
    // Ensure DB instance is available for deleteProcessingJobs
    let db = globalThis.db;
    if (!db) {
      const { getDb: getDbLocal } = await import('../database/Db_Operations.js');
      db = await getDbLocal();
      globalThis.db = db;
    }
    return await deleteProcessingJobs(job.data, db);
  } else if (job.name === 'deleteShowsAndCleanup') {
    const { showIds } = job.data;
    if (!Array.isArray(showIds) || showIds.length === 0) {
      throw new Error('No showIds provided');
    }
    let db = globalThis.db;
    if (!db) {
      const { getDb: getDbLocal } = await import('../database/Db_Operations.js');
      db = await getDbLocal();
      globalThis.db = db;
    }
    return await deleteShowsAndCleanup(showIds, db);
  } else {
    throw new Error('Unknown cleanup job type: ' + job.name);
  }
}, { connection: redis });

cleanupWorker.on('completed', (job, result) => {
  workerLogger.info({ jobId: job.id, result }, 'Cleanup job completed');
});
cleanupWorker.on('failed', (job, err) => {
  workerLogger.error({ jobId: job.id, error: err && err.message }, 'Cleanup job failed');
});

/**
 * Enqueue a cleanup job.
 * @param {'deleteProcessingJobs'|'deleteShowsAndCleanup'} type
 * @param {object} data
 * @returns {Promise<string>} jobId
 */
export async function enqueueCleanupJob(type, data) {
  const job = await cleanupQueue.add(type, data, { removeOnComplete: true, removeOnFail: false });
  workerLogger.info({ jobId: job.id, type, data }, 'Enqueued cleanup job');
  return job.id;
}

export { queues };
