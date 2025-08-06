// queueManager.js
// Worker/Queue management functions will be moved here from queue.js
import { workerLogger } from './logger.js';
import { getDb, getSetting } from '../database/Db_Operations.js';
import { broadcastJobUpdate, broadcastQueueStatus } from './websocket.js';
import { Queue, Worker, QueueEvents } from 'bullmq';
import Redis from 'ioredis';

// Replace the redis instance with a plain connection object
// Allow Redis connection to be configured via environment
const redisHost = process.env.REDIS_HOST || 'localhost';
const redisPort = process.env.REDIS_PORT || 6379;
const redisConnection = `redis://${redisHost}:${redisPort}`;

let QUEUE_CONFIG = {};
const queues = {};
const workers = {};
let episodeProcessingQueueEvents;

export async function getWorkerLimits() {
  try {
    const db = await getDb();
    return {
      cpu: parseInt(getSetting(db, 'cpu_worker_limit', '2'), 10),
      gpu: parseInt(getSetting(db, 'gpu_worker_limit', '1'), 10),
    };
  } catch (error) {
    workerLogger.warn('Failed to get worker limits from database, using defaults:', error.message);
    return { cpu: 2, gpu: 1 };
  }
}

export async function updateQueueConfig() {
  try {
    const limits = await getWorkerLimits();
    workerLogger.info('Worker limits from DB:', limits);
    QUEUE_CONFIG = {
      episodeProcessing: {
        name: 'episode-processing',
        concurrency: limits.cpu,
        retries: 3,
        backoff: 5000,
        timeout: 300000,
      },
      audioExtraction: {
        name: 'audio-extraction',
        concurrency: limits.cpu,
        retries: 2,
        backoff: 3000,
        timeout: 120000,
      },
      fingerprinting: {
        name: 'fingerprinting',
        concurrency: limits.cpu,
        retries: 2,
        backoff: 2000,
        timeout: 180000,
      },
      detection: {
        name: 'detection',
        concurrency: Math.min(limits.cpu, 4),
        retries: 1,
        backoff: 1000,
        timeout: 60000,
      },
      trimming: {
        name: 'trimming',
        concurrency: limits.gpu,
        retries: 1,
        backoff: 1000,
        timeout: 120000,
      },
      cleanup: {
        name: 'cleanup',
        concurrency: 1,
        retries: 1,
        backoff: 1000,
        timeout: 60000,
      },
    };
    workerLogger.info('Queue configuration updated:', QUEUE_CONFIG);
  } catch (error) {
    workerLogger.error('Failed to update queue configuration, using defaults:', error);
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
      cleanup: {
        name: 'cleanup',
        concurrency: 1,
        retries: 1,
        backoff: 1000,
        timeout: 60000,
      },
    };
  }
}

export async function initializeQueues() {
  workerLogger.info('Starting queue initialization...');
  console.log('[queueManager] initializeQueues called');
  try {
    try {
      // Use a temporary ioredis instance for ping
      const testRedis = new Redis(redisConnection);
      await testRedis.ping();
      await testRedis.quit();
      workerLogger.info('Redis connection test successful');
      console.log('[queueManager] Redis connection test successful');
    } catch (redisError) {
      workerLogger.error('Redis connection test failed:', redisError);
      console.error('[queueManager] Redis connection test failed:', redisError);
      throw new Error(`Redis connection failed: ${redisError.message}`);
    }
    await updateQueueConfig();
    console.log('[queueManager] Queue config updated');
    const initializedQueues = [];
    for (const [_name, config] of Object.entries(QUEUE_CONFIG)) {
      try {
        workerLogger.info(`Initializing queue: ${config.name}`);
        console.log(`[queueManager] Initializing queue: ${config.name}`);
        const queue = new Queue(config.name, {
          connection: redisConnection,
          defaultJobOptions: {
            removeOnComplete: false,
            removeOnFail: false,
          },
        });
        console.log(`[queueManager] Queue ${config.name} created with opts:`, queue.opts);
        queues[config.name] = queue;
        initializedQueues.push(config.name);
        workerLogger.info(`Queue ${config.name} initialized successfully`);
        console.log(`[queueManager] Queue ${config.name} initialized successfully`);
      } catch (error) {
        workerLogger.error(`Failed to initialize queue ${config.name}:`, error);
        console.error(`[queueManager] Failed to initialize queue ${config.name}:`, error);
      }
    }
    if (!episodeProcessingQueueEvents) {
      episodeProcessingQueueEvents = new QueueEvents('episode-processing', { connection: redisConnection });
      episodeProcessingQueueEvents.on('progress', async ({ jobId, data }) => {
        workerLogger.info('[QueueEvents] Progress event:', { jobId, data });
      });
    }
    workerLogger.info(
      `Queue initialization completed. ${initializedQueues.length}/${Object.keys(QUEUE_CONFIG).length} queues initialized successfully.`,
    );
    console.log(`[queueManager] Queue initialization completed. ${initializedQueues.length}/${Object.keys(QUEUE_CONFIG).length} queues initialized successfully.`);
    if (initializedQueues.length === 0) {
      throw new Error('No queues were initialized successfully');
    }
  } catch (error) {
    workerLogger.error('Failed to initialize queues:', error);
    console.error('[queueManager] Failed to initialize queues:', error);
    throw error;
  }
}

export async function startQueues() {
  workerLogger.info('Starting queue workers...');
  console.log('[queueManager] startQueues called');
  try {
    await updateQueueConfig();
    console.log('[queueManager] Queue config updated (startQueues)');
    const startedWorkers = [];
    for (const [name, config] of Object.entries(QUEUE_CONFIG)) {
      try {
        workerLogger.info(
          `Starting worker for queue: ${config.name} with concurrency ${config.concurrency}`,
        );
        console.log(`[queueManager] Starting worker for queue: ${config.name} with concurrency ${config.concurrency}`);

        let worker;
        if (config.name === 'cleanup') {
          // Special worker for cleanup jobs
          const { deleteProcessingJobs, deleteShowsAndCleanup } = await import('./cleanupService.js');
          worker = new Worker(
            config.name,
            async (job) => {
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
            },
            {
              connection: redisConnection,
              concurrency: config.concurrency,
              stalledInterval: 60000,
              maxStalledCount: 2,
            },
          );
          worker.on('completed', (job, result) => {
            workerLogger.info({ jobId: job.id, result }, 'Cleanup job completed');
          });
          worker.on('failed', (job, err) => {
            workerLogger.error({ jobId: job.id, error: err && err.message }, 'Cleanup job failed');
          });
        } else {
          // Standard worker for other job types
          worker = new Worker(
            config.name,
            async (job) => {
              const { processJob } = await import('./jobProcessor.js');
              return await processJob(job.name, job);
            },
            {
              connection: redisConnection,
              concurrency: config.concurrency,
              stalledInterval: 60000,
              maxStalledCount: 2,
            },
          );
        }

        workerLogger.info(
          `Worker instance created for ${name} with concurrency: ${config.concurrency}`,
        );
        console.log(`[queueManager] Worker instance created for ${name} with concurrency: ${config.concurrency}`);
        setupWorkerEvents(worker, name);
        workers[name] = worker;
        startedWorkers.push(name);
        workerLogger.info(
          `Worker for ${name} started successfully with concurrency ${config.concurrency}`,
        );
        console.log(`[queueManager] Worker for ${name} started successfully with concurrency ${config.concurrency}`);
      } catch (error) {
        workerLogger.error(`Failed to start worker for ${name}:`, error);
        console.error(`[queueManager] Failed to start worker for ${name}:`, error);
      }
    }
    workerLogger.info(
      `Worker startup completed. ${startedWorkers.length}/${Object.keys(QUEUE_CONFIG).length} workers started successfully.`,
    );
    console.log(`[queueManager] Worker startup completed. ${startedWorkers.length}/${Object.keys(QUEUE_CONFIG).length} workers started successfully.`);
    if (startedWorkers.length === 0) {
      throw new Error('No workers were started successfully');
    }
  } catch (error) {
    workerLogger.error('Failed to start queue workers:', error);
    console.error('[queueManager] Failed to start queue workers:', error);
    throw error;
  }
}

export async function stopQueues() {
  for (const [name, worker] of Object.entries(workers)) {
    await worker.close();
    workerLogger.info(`Worker ${name} stopped`);
  }
  await redisConnection.quit();
  workerLogger.info('All queues stopped');
}

export async function updateWorkerLimits() {
  workerLogger.info('Updating worker limits from settings...');
  try {
    for (const [name, worker] of Object.entries(workers)) {
      await worker.close();
      workerLogger.info(`Worker ${name} stopped for reconfiguration`);
    }
    Object.keys(workers).forEach((key) => delete workers[key]);
    await updateQueueConfig();
    await startQueues();
    workerLogger.info('Worker limits updated and workers restarted successfully');
  } catch (error) {
    workerLogger.error('Failed to update worker limits:', error);
    throw error;
  }
}

export function setupWorkerEvents(worker, workerName) {
  worker.on('completed', (job, result) => {
    workerLogger.info({ jobId: job.id, workerName, result }, 'Job completed');
  });
  worker.on('failed', (job, err) => {
    workerLogger.error({ jobId: job.id, workerName, error: err.message }, 'Job failed');
  });
  worker.on('error', (err) => {
    workerLogger.error({ workerName, error: err.message }, 'Worker error');
  });
}

export async function ensureQueuesInitialized() {
  if (Object.keys(queues).length === 0) {
    await initializeQueues();
  }
}

export async function pauseCpuWorkers() {
  for (const [name, worker] of Object.entries(workers)) {
    if (['audio-extraction', 'fingerprinting', 'detection', 'episode-processing'].includes(name)) {
      if (worker && typeof worker.pause === 'function') {
        await worker.pause(true);
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

export function getQueue(name) {
  return queues[name];
}

export function getQueues() {
  return queues;
}

export function getWorkers() {
  return workers;
}

export function debugQueueState() {
  return {
    queues: Object.keys(queues),
    workers: Object.keys(workers),
    queueConfig: QUEUE_CONFIG,
  };
}
