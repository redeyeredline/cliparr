// queueManager.js
// Worker/Queue management functions will be moved here from queue.js
import { workerLogger } from './logger.js';
import { getDb, getSetting } from '../database/Db_Operations.js';
import { broadcastJobUpdate, broadcastQueueStatus } from './websocket.js';
import { Queue, Worker, QueueEvents } from 'bullmq';
import Redis from 'ioredis';

// Redis connection
const redis = new Redis({
  host: 'localhost',
  port: 6379,
  maxRetriesPerRequest: null,
  retryDelayOnFailover: 100,
  enableReadyCheck: false,
});

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
    };
  }
}

export async function initializeQueues() {
  workerLogger.info('Starting queue initialization...');
  try {
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
      }
    }
    if (!episodeProcessingQueueEvents) {
      episodeProcessingQueueEvents = new QueueEvents('episode-processing', { connection: redis });
      episodeProcessingQueueEvents.on('progress', async ({ jobId, data }) => {
        workerLogger.info('[QueueEvents] Progress event:', { jobId, data });
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
        workerLogger.info(
          { jobId, dbJobId, progress: data },
          '[QueueEvents] Broadcasting job update',
        );
        broadcastJobUpdate({
          type: 'job_update',
          jobId,
          dbJobId,
          progress: data,
          status: 'processing',
        });
      });
    }
    workerLogger.info(
      `Queue initialization completed. ${initializedQueues.length}/${Object.keys(QUEUE_CONFIG).length} queues initialized successfully.`,
    );
    if (initializedQueues.length === 0) {
      throw new Error('No queues were initialized successfully');
    }
  } catch (error) {
    workerLogger.error('Failed to initialize queues:', error);
    throw error;
  }
}

export async function startQueues() {
  workerLogger.info('Starting queue workers...');
  try {
    await updateQueueConfig();
    const startedWorkers = [];
    for (const [name, config] of Object.entries(QUEUE_CONFIG)) {
      try {
        workerLogger.info(
          `Starting worker for queue: ${config.name} with concurrency ${config.concurrency}`,
        );
        const worker = new Worker(
          config.name,
          async (job) => {
            const { processJob } = await import('./jobProcessor.js');
            return await processJob(job.name, job);
          },
          {
            connection: redis,
            concurrency: config.concurrency,
            stalledInterval: 60000,
            maxStalledCount: 2,
          },
        );
        workerLogger.info(
          `Worker instance created for ${name} with concurrency: ${config.concurrency}`,
        );
        setupWorkerEvents(worker, name);
        workers[name] = worker;
        startedWorkers.push(name);
        workerLogger.info(
          `Worker for ${name} started successfully with concurrency ${config.concurrency}`,
        );
      } catch (error) {
        workerLogger.error(`Failed to start worker for ${name}:`, error);
      }
    }
    workerLogger.info(
      `Worker startup completed. ${startedWorkers.length}/${Object.keys(QUEUE_CONFIG).length} workers started successfully.`,
    );
    if (startedWorkers.length === 0) {
      throw new Error('No workers were started successfully');
    }
  } catch (error) {
    workerLogger.error('Failed to start queue workers:', error);
    throw error;
  }
}

export async function stopQueues() {
  for (const [name, worker] of Object.entries(workers)) {
    await worker.close();
    workerLogger.info(`Worker ${name} stopped`);
  }
  await redis.quit();
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
