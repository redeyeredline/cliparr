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
let recoveryInterval = null;

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

export async function recoverInterruptedJobs() {
  workerLogger.info('Starting job recovery process...');
  console.log('[queueManager] Starting job recovery process...');
  
  try {
    const db = await getDb();
    
    // Get all processing jobs that were interrupted
    const interruptedJobs = db.prepare(`
      SELECT 
        pj.id as job_id,
        pj.media_file_id,
        pj.status,
        ef.file_path,
        e.title as episode_title,
        e.episode_number,
        s.season_number,
        sh.title as show_title
      FROM processing_jobs pj
      JOIN episode_files ef ON pj.media_file_id = ef.id
      JOIN episodes e ON ef.episode_id = e.id
      JOIN seasons s ON e.season_id = s.id
      JOIN shows sh ON s.show_id = sh.id
      WHERE pj.status IN ('scanning', 'processing')
      ORDER BY pj.created_date ASC
    `).all();
    
    workerLogger.info(`Found ${interruptedJobs.length} interrupted jobs to recover`);
    console.log(`[queueManager] Found ${interruptedJobs.length} interrupted jobs to recover`);
    
    if (interruptedJobs.length === 0) {
      workerLogger.info('No interrupted jobs found');
      console.log('[queueManager] No interrupted jobs found');
      return;
    }
    
    // Group jobs by status
    const scanningJobs = interruptedJobs.filter(job => job.status === 'scanning');
    const processingJobs = interruptedJobs.filter(job => job.status === 'processing');
    
    workerLogger.info(`Recovering ${scanningJobs.length} scanning jobs and ${processingJobs.length} processing jobs`);
    console.log(`[queueManager] Recovering ${scanningJobs.length} scanning jobs and ${processingJobs.length} processing jobs`);
    
    let recoveredCount = 0;
    let failedCount = 0;
    
    // Re-enqueue scanning jobs (these were never started)
    if (scanningJobs.length > 0) {
      const episodeFileAndJobIds = scanningJobs.map(job => ({
        episodeFileId: job.media_file_id,
        dbJobId: job.job_id
      }));
      
      try {
        const { enqueueEpisodeProcessing } = await import('./queueOperations.js');
        await enqueueEpisodeProcessing(episodeFileAndJobIds);
        recoveredCount += scanningJobs.length;
        workerLogger.info(`Successfully re-enqueued ${scanningJobs.length} scanning jobs`);
        console.log(`[queueManager] Successfully re-enqueued ${scanningJobs.length} scanning jobs`);
      } catch (error) {
        failedCount += scanningJobs.length;
        workerLogger.error('Failed to re-enqueue scanning jobs:', error);
        console.error('[queueManager] Failed to re-enqueue scanning jobs:', error);
      }
    }
    
    // Re-enqueue processing jobs (these were interrupted during processing)
    if (processingJobs.length > 0) {
      const episodeFileAndJobIds = processingJobs.map(job => ({
        episodeFileId: job.media_file_id,
        dbJobId: job.job_id
      }));
      
      try {
        const { enqueueEpisodeProcessing } = await import('./queueOperations.js');
        await enqueueEpisodeProcessing(episodeFileAndJobIds);
        recoveredCount += processingJobs.length;
        workerLogger.info(`Successfully re-enqueued ${processingJobs.length} processing jobs`);
        console.log(`[queueManager] Successfully re-enqueued ${processingJobs.length} processing jobs`);
      } catch (error) {
        failedCount += processingJobs.length;
        workerLogger.error('Failed to re-enqueue processing jobs:', error);
        console.error('[queueManager] Failed to re-enqueue processing jobs:', error);
      }
    }
    
    workerLogger.info(`Job recovery process completed: ${recoveredCount} recovered, ${failedCount} failed`);
    console.log(`[queueManager] Job recovery process completed: ${recoveredCount} recovered, ${failedCount} failed`);
    
    return { recoveredCount, failedCount, totalJobs: interruptedJobs.length };
    
  } catch (error) {
    workerLogger.error('Failed to recover interrupted jobs:', error);
    console.error('[queueManager] Failed to recover interrupted jobs:', error);
    // Don't throw error - job recovery failure shouldn't prevent app startup
    return { recoveredCount: 0, failedCount: 0, totalJobs: 0, error: error.message };
  }
}

export async function synchronizeJobStates() {
  workerLogger.info('Synchronizing job states between database and Redis...');
  console.log('[queueManager] Synchronizing job states between database and Redis...');
  
  try {
    const db = await getDb();
    const episodeProcessingQueue = queues['episode-processing'];
    
    if (!episodeProcessingQueue) {
      workerLogger.warn('Episode processing queue not available for state synchronization');
      console.log('[queueManager] Episode processing queue not available for state synchronization');
      return { synchronized: false, reason: 'Queue not available' };
    }
    
    // Get all jobs from Redis
    const redisJobs = await episodeProcessingQueue.getJobs(['waiting', 'active', 'delayed']);
    const redisJobIds = new Set(redisJobs.map(job => job.data?.dbJobId).filter(Boolean));
    
    // Get all processing jobs from database
    const dbJobs = db.prepare(`
      SELECT id, status, media_file_id 
      FROM processing_jobs 
      WHERE status IN ('scanning', 'processing')
    `).all();
    
    const dbJobIds = new Set(dbJobs.map(job => job.id.toString()));
    
    let missingInRedisCount = 0;
    let orphanedInRedisCount = 0;
    
    // Find jobs that exist in database but not in Redis
    const missingInRedis = dbJobIds.filter(id => !redisJobIds.has(id));
    
    if (missingInRedis.length > 0) {
      workerLogger.info(`Found ${missingInRedis.length} jobs in database that are missing from Redis`);
      console.log(`[queueManager] Found ${missingInRedis.length} jobs in database that are missing from Redis`);
      
      // Re-enqueue missing jobs
      const missingJobs = dbJobs.filter(job => missingInRedis.includes(job.id.toString()));
      const episodeFileAndJobIds = missingJobs.map(job => ({
        episodeFileId: job.media_file_id,
        dbJobId: job.id
      }));
      
      try {
        const { enqueueEpisodeProcessing } = await import('./queueOperations.js');
        await enqueueEpisodeProcessing(episodeFileAndJobIds);
        missingInRedisCount = missingJobs.length;
        workerLogger.info(`Successfully re-enqueued ${missingJobs.length} missing jobs`);
        console.log(`[queueManager] Successfully re-enqueued ${missingJobs.length} missing jobs`);
      } catch (error) {
        workerLogger.error('Failed to re-enqueue missing jobs:', error);
        console.error('[queueManager] Failed to re-enqueue missing jobs:', error);
      }
    }
    
    // Find jobs that exist in Redis but not in database (orphaned jobs)
    const missingInDb = redisJobIds.filter(id => !dbJobIds.has(id));
    
    if (missingInDb.length > 0) {
      workerLogger.warn(`Found ${missingInDb.length} orphaned jobs in Redis that don't exist in database`);
      console.log(`[queueManager] Found ${missingInDb.length} orphaned jobs in Redis that don't exist in database`);
      
      // Remove orphaned jobs from Redis
      for (const jobId of missingInDb) {
        try {
          const job = redisJobs.find(j => j.data?.dbJobId === jobId);
          if (job) {
            await job.remove();
            orphanedInRedisCount++;
            workerLogger.info(`Removed orphaned job ${jobId} from Redis`);
            console.log(`[queueManager] Removed orphaned job ${jobId} from Redis`);
          }
        } catch (error) {
          workerLogger.error(`Failed to remove orphaned job ${jobId}:`, error);
          console.error(`[queueManager] Failed to remove orphaned job ${jobId}:`, error);
        }
      }
    }
    
    workerLogger.info('Job state synchronization completed');
    console.log('[queueManager] Job state synchronization completed');
    
    return { 
      synchronized: true, 
      missingInRedisCount, 
      orphanedInRedisCount,
      totalRedisJobs: redisJobs.length,
      totalDbJobs: dbJobs.length
    };
    
  } catch (error) {
    workerLogger.error('Failed to synchronize job states:', error);
    console.error('[queueManager] Failed to synchronize job states:', error);
    return { synchronized: false, error: error.message };
  }
}

export async function checkAndCleanupStaleJobs() {
  workerLogger.info('Checking for stale jobs in Redis queues...');
  console.log('[queueManager] Checking for stale jobs in Redis queues...');
  
  try {
    let totalStaleJobs = 0;
    let totalJobsChecked = 0;
    
    for (const [queueName, queue] of Object.entries(queues)) {
      try {
        // Get all jobs in the queue
        const waiting = await queue.getWaiting();
        const active = await queue.getActive();
        const delayed = await queue.getDelayed();
        
        totalJobsChecked += waiting.length + active.length + delayed.length;
        
        workerLogger.info(`Queue ${queueName}: ${waiting.length} waiting, ${active.length} active, ${delayed.length} delayed`);
        console.log(`[queueManager] Queue ${queueName}: ${waiting.length} waiting, ${active.length} active, ${delayed.length} delayed`);
        
        // Check if any active jobs are stale (running for too long)
        const now = Date.now();
        const staleThreshold = 30 * 60 * 1000; // 30 minutes
        
        for (const job of active) {
          const jobAge = now - job.timestamp;
          if (jobAge > staleThreshold) {
            workerLogger.warn(`Found stale job ${job.id} in queue ${queueName}, age: ${Math.round(jobAge / 1000)}s`);
            console.log(`[queueManager] Found stale job ${job.id} in queue ${queueName}, age: ${Math.round(jobAge / 1000)}s`);
            
            // Move stale job back to waiting state
            try {
              await job.moveToWaiting();
              totalStaleJobs++;
              workerLogger.info(`Moved stale job ${job.id} back to waiting state`);
              console.log(`[queueManager] Moved stale job ${job.id} back to waiting state`);
            } catch (moveError) {
              workerLogger.error(`Failed to move stale job ${job.id}:`, moveError);
              console.error(`[queueManager] Failed to move stale job ${job.id}:`, moveError);
            }
          }
        }
        
      } catch (queueError) {
        workerLogger.error(`Error checking queue ${queueName}:`, queueError);
        console.error(`[queueManager] Error checking queue ${queueName}:`, queueError);
      }
    }
    
    workerLogger.info(`Stale job cleanup completed: ${totalStaleJobs} stale jobs moved, ${totalJobsChecked} total jobs checked`);
    console.log(`[queueManager] Stale job cleanup completed: ${totalStaleJobs} stale jobs moved, ${totalJobsChecked} total jobs checked`);
    
    return { totalStaleJobs, totalJobsChecked };
    
  } catch (error) {
    workerLogger.error('Failed to check for stale jobs:', error);
    console.error('[queueManager] Failed to check for stale jobs:', error);
    return { totalStaleJobs: 0, totalJobsChecked: 0, error: error.message };
  }
}

export async function startPeriodicJobRecovery() {
  workerLogger.info('Starting periodic job recovery...');
  console.log('[queueManager] Starting periodic job recovery...');
  
  // Clear any existing interval
  if (recoveryInterval) {
    clearInterval(recoveryInterval);
  }
  
  // Run recovery every 5 minutes
  recoveryInterval = setInterval(async () => {
    try {
      workerLogger.info('Running periodic job recovery check...');
      console.log('[queueManager] Running periodic job recovery check...');
      
      // Check for stale jobs
      const staleResult = await checkAndCleanupStaleJobs();
      
      // Synchronize job states
      const syncResult = await synchronizeJobStates();
      
      // Only recover jobs if there are issues detected
      if (staleResult.totalStaleJobs > 0 || 
          (syncResult.synchronized && (syncResult.missingInRedisCount > 0 || syncResult.orphanedInRedisCount > 0))) {
        
        const recoveryResult = await recoverInterruptedJobs();
        
        workerLogger.info('Periodic recovery completed:', {
          staleJobs: staleResult.totalStaleJobs,
          missingJobs: syncResult.missingInRedisCount || 0,
          orphanedJobs: syncResult.orphanedInRedisCount || 0,
          recoveredJobs: recoveryResult.recoveredCount || 0
        });
        console.log('[queueManager] Periodic recovery completed:', {
          staleJobs: staleResult.totalStaleJobs,
          missingJobs: syncResult.missingInRedisCount || 0,
          orphanedJobs: syncResult.orphanedInRedisCount || 0,
          recoveredJobs: recoveryResult.recoveredCount || 0
        });
      } else {
        workerLogger.info('Periodic recovery check: No issues detected');
        console.log('[queueManager] Periodic recovery check: No issues detected');
      }
      
    } catch (error) {
      workerLogger.error('Periodic job recovery failed:', error);
      console.error('[queueManager] Periodic job recovery failed:', error);
    }
  }, 5 * 60 * 1000); // 5 minutes
  
  workerLogger.info('Periodic job recovery started (runs every 5 minutes)');
  console.log('[queueManager] Periodic job recovery started (runs every 5 minutes)');
}

export async function stopPeriodicJobRecovery() {
  if (recoveryInterval) {
    clearInterval(recoveryInterval);
    recoveryInterval = null;
    workerLogger.info('Periodic job recovery stopped');
    console.log('[queueManager] Periodic job recovery stopped');
  }
}

export async function getJobRecoveryStatus() {
  try {
    const db = await getDb();
    
    // Get job statistics from database
    const dbStats = db.prepare(`
      SELECT 
        status,
        COUNT(*) as count
      FROM processing_jobs
      GROUP BY status
    `).all();
    
    // Get queue statistics from Redis
    const queueStats = {};
    for (const [queueName, queue] of Object.entries(queues)) {
      try {
        const waiting = await queue.getWaiting();
        const active = await queue.getActive();
        const delayed = await queue.getDelayed();
        const completed = await queue.getCompleted();
        const failed = await queue.getFailed();
        
        queueStats[queueName] = {
          waiting: waiting.length,
          active: active.length,
          delayed: delayed.length,
          completed: completed.length,
          failed: failed.length,
          total: waiting.length + active.length + delayed.length + completed.length + failed.length
        };
      } catch (error) {
        queueStats[queueName] = { error: error.message };
      }
    }
    
    // Check for potential issues
    const issues = [];
    
    // Check for stale jobs
    for (const [queueName, stats] of Object.entries(queueStats)) {
      if (stats.active > 0) {
        const now = Date.now();
        const staleThreshold = 30 * 60 * 1000; // 30 minutes
        
        try {
          const queue = queues[queueName];
          const activeJobs = await queue.getActive();
          
          for (const job of activeJobs) {
            const jobAge = now - job.timestamp;
            if (jobAge > staleThreshold) {
              issues.push({
                type: 'stale_job',
                queue: queueName,
                jobId: job.id,
                age: Math.round(jobAge / 1000),
                threshold: Math.round(staleThreshold / 1000)
              });
            }
          }
        } catch (error) {
          issues.push({
            type: 'queue_error',
            queue: queueName,
            error: error.message
          });
        }
      }
    }
    
    // Check for database/Redis synchronization issues
    const episodeProcessingQueue = queues['episode-processing'];
    if (episodeProcessingQueue) {
      try {
        const redisJobs = await episodeProcessingQueue.getJobs(['waiting', 'active', 'delayed']);
        const redisJobIds = new Set(redisJobs.map(job => job.data?.dbJobId).filter(Boolean));
        
        const dbJobs = db.prepare(`
          SELECT id, status, media_file_id 
          FROM processing_jobs 
          WHERE status IN ('scanning', 'processing')
        `).all();
        
        const dbJobIds = new Set(dbJobs.map(job => job.id.toString()));
        
        const missingInRedis = dbJobIds.filter(id => !redisJobIds.has(id));
        const missingInDb = redisJobIds.filter(id => !dbJobIds.has(id));
        
        if (missingInRedis.length > 0) {
          issues.push({
            type: 'missing_in_redis',
            count: missingInRedis.length,
            jobIds: missingInRedis
          });
        }
        
        if (missingInDb.length > 0) {
          issues.push({
            type: 'orphaned_in_redis',
            count: missingInDb.length,
            jobIds: missingInDb
          });
        }
      } catch (error) {
        issues.push({
          type: 'sync_error',
          error: error.message
        });
      }
    }
    
    return {
      database: {
        total: dbStats.reduce((sum, stat) => sum + stat.count, 0),
        byStatus: dbStats.reduce((acc, stat) => {
          acc[stat.status] = stat.count;
          return acc;
        }, {})
      },
      queues: queueStats,
      issues,
      recoveryActive: recoveryInterval !== null,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    workerLogger.error('Failed to get job recovery status:', error);
    console.error('[queueManager] Failed to get job recovery status:', error);
    return {
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}
