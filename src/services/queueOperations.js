// queueOperations.js
// Queue operations functions will be moved here from queue.js
import { workerLogger } from './logger.js';
import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
import { deleteProcessingJobs, deleteShowsAndCleanup } from './cleanupService.js';

// Redis connection
const redis = new Redis({
  host: 'localhost',
  port: 6379,
  maxRetriesPerRequest: null,
  retryDelayOnFailover: 100,
  enableReadyCheck: false,
});

// These will be imported from queueManager.js
let queues = {};
let workers = {};

// Function to set queues and workers (will be called from main queue.js)
export function setQueueReferences(queueRefs, workerRefs) {
  queues = queueRefs;
  workers = workerRefs;
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
      // This will be imported from queueManager.js
      const { initializeQueues, startQueues } = await import('./queueManager.js');
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

// Clean all queues (remove completed and failed jobs)
export async function cleanAllQueues() {
  workerLogger.info('Cleaning all queues...');

  for (const [name, queue] of Object.entries(queues)) {
    try {
      // Clean completed jobs (keep last 100)
      await queue.clean(1000 * 60 * 60 * 24, 'completed', 100);
      // Clean failed jobs (keep last 50)
      await queue.clean(1000 * 60 * 60 * 24, 'failed', 50);

      workerLogger.info({ queue: name }, 'Cleaned queue');
    } catch (err) {
      workerLogger.error({ queue: name, error: err.message }, 'Failed to clean queue');
    }
  }

  workerLogger.info('All queues cleaned successfully');
}

// Remove a specific job from all queues
export async function removeJobFromAllQueues(jobId) {
  workerLogger.info({ jobId }, 'Removing job from all queues...');

  let removed = false;

  for (const [queueName, queue] of Object.entries(queues)) {
    try {
      const job = await queue.getJob(jobId);
      if (!job) {
        continue;
      }

      const jobState = await job.getState();
      workerLogger.info({ jobId, queue: queueName, state: jobState }, 'Found job in queue');

      if (jobState === 'active') {
        // For active jobs, we need to be more aggressive
        const worker = workers[queueName];
        if (worker && typeof worker.pause === 'function') {
          await worker.pause(true);
          workerLogger.info({ jobId, queue: queueName }, 'Paused worker for job removal');
        }

        // Force remove from Redis
        const redisClient = queue.client;
        const delayedKey = `${queueName}:delayed`;
        const waitingKey = `${queueName}:wait`;

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
