// BullMQ-based job queue system for processing shows
// Handles job orchestration, scaling, and progress tracking
import { logger } from './logger.js';
import { processShowJob } from './processors/showProcessor.js';
import { getDb } from '../database/Db_Operations.js';
import { broadcastJobUpdate, broadcastQueueStatus } from './websocket.js';

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

// Queue configuration
const QUEUE_CONFIG = {
  showProcessing: {
    name: 'show-processing',
    concurrency: 2,
    retries: 3,
    backoff: 5000,
  },
  audioExtraction: {
    name: 'audio-extraction',
    concurrency: 3,
    retries: 2,
    backoff: 3000,
  },
  fingerprinting: {
    name: 'fingerprinting',
    concurrency: 4,
    retries: 2,
    backoff: 2000,
  },
  detection: {
    name: 'detection',
    concurrency: 2,
    retries: 1,
    backoff: 1000,
  },
  trimming: {
    name: 'trimming',
    concurrency: 2,
    retries: 1,
    backoff: 1000,
  },
};

// Queue instances
const queues = {};
const workers = {};

// Initialize all queues
export async function initializeQueues() {
  logger.info('Starting queue initialization...');

  try {
    await initBullMQ();
    logger.info('BullMQ imports initialized successfully');

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

    for (const [name, config] of Object.entries(QUEUE_CONFIG)) {
      logger.info(`Starting worker for queue: ${config.name} with concurrency ${config.concurrency}`);

      const worker = new Worker(config.name, async (job) => {
        logger.info({ jobId: job.id, queue: name }, 'Processing job');

        try {
          const result = await processJob(job.name, job);
          logger.info({ jobId: job.id, queue: name }, 'Job completed successfully');
          return result;
        } catch (error) {
          logger.error({ jobId: job.id, queue: name, error: error.message }, 'Job failed');
          throw error;
        }
      }, {
        connection: redis,
        concurrency: config.concurrency,
      });

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

// Setup worker event handlers
function setupWorkerEvents(worker, workerName) {
  worker.on('completed', (job, result) => {
    logger.info({ jobId: job.id, worker: workerName }, 'Job completed successfully');

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

  worker.on('active', (job) => {
    logger.info({ jobId: job.id, worker: workerName }, 'Job started processing');

    // Broadcast job started
    broadcastJobUpdate({
      jobId: job.id,
      status: 'active',
      worker: workerName,
    });

    // Broadcast updated queue status
    getQueueStatus().then((status) => {
      broadcastQueueStatus({ queues: status });
    });
  });

  worker.on('waiting', (job) => {
    logger.info({ jobId: job.id, worker: workerName }, 'Job waiting to be processed');

    // Broadcast job waiting
    broadcastJobUpdate({
      jobId: job.id,
      status: 'waiting',
      worker: workerName,
    });

    // Broadcast updated queue status
    getQueueStatus().then((status) => {
      broadcastQueueStatus({ queues: status });
    });
  });
}

// Process different job types
async function processJob(jobType, jobOrData) {
  switch (jobType) {
    case 'show-processing':
      return await processShowJob(jobOrData);
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
  // Simulate audio extraction
  await new Promise((resolve) => setTimeout(resolve, 2000));
  return { message: 'Audio extracted successfully', duration: 120.5 };
}

async function processFingerprinting(jobData) {
  logger.info({ jobData }, 'Processing fingerprinting');
  // Simulate fingerprinting
  await new Promise((resolve) => setTimeout(resolve, 1500));
  return { message: 'Fingerprint generated', fingerprint: 'abc123...' };
}

async function processDetection(jobData) {
  logger.info({ jobData }, 'Processing detection');
  // Simulate detection
  await new Promise((resolve) => setTimeout(resolve, 1000));
  return { message: 'Segments detected', segments: 5 };
}

async function processTrimming(jobData) {
  logger.info({ jobData }, 'Processing trimming');
  // Simulate trimming
  await new Promise((resolve) => setTimeout(resolve, 3000));
  return { message: 'Video trimmed successfully', clips: 3 };
}

// Enqueue a show processing job
export async function enqueueShowProcessing(showIds) {
  // Ensure queues are initialized
  await ensureQueuesInitialized();

  const queue = queues['show-processing'];
  if (!queue) {
    const debugState = debugQueueState();
    logger.error('Show processing queue not found. Debug state:', debugState);
    throw new Error('Show processing queue not initialized');
  }

  logger.info('enqueueShowProcessing called with showIds:', showIds);

  // Enqueue one job per valid showId
  const jobIds = [];
  for (const showId of showIds) {
    if (!showId) {
      logger.warn('Skipping invalid showId:', showId);
      continue;
    }
    const job = await queue.add('show-processing', { showId }, {
      priority: 10,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
    });
    logger.info({ jobId: job.id, showId }, 'Show processing job enqueued');
    logger.info('Full job object:', job);
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
    showProcessingQueue: !!queues['show-processing'],
  };
}

// Ensure queues are initialized before use
async function ensureQueuesInitialized() {
  logger.info('Checking queue initialization state...');
  logger.info('Current queues object:', queues);
  logger.info('Current workers object:', workers);
  logger.info('Queues object keys:', Object.keys(queues));
  logger.info('Queues object length:', Object.keys(queues).length);

  // Check if the show-processing queue specifically exists
  if (!queues['show-processing']) {
    logger.warn('Show processing queue not found, attempting to initialize queues...');
    try {
      await initializeQueues();
      await startQueues();
      logger.info('Queues initialized successfully in ensureQueuesInitialized');
    } catch (error) {
      logger.error('Failed to initialize queues in ensureQueuesInitialized:', error);
      throw error;
    }
  } else {
    logger.info('Show processing queue already exists');
  }
}
