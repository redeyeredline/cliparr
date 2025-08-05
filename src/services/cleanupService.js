import path from 'path';
import fs from 'fs/promises';
import {
  queues,
  removeJobFromAllQueues,
  pauseCpuWorkers,
  resumeCpuWorkers,
  pauseGpuWorkers,
  resumeGpuWorkers,
} from './queue.js';
import {
  getProcessingJobById,
  deleteProcessingJob,
  getEpisodeFileIdAndJobIdForShows,
  deleteProcessingJobsBatch,
} from '../database/Db_Operations.js';
import { appLogger as logger } from './logger.js';
import Redis from 'ioredis';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Simple function to directly clean up scanning jobs from database
 * This bypasses all the complex queue logic and just deletes from DB
 */
export async function cleanupScanningJobs(dbOverride = null) {
  const db = dbOverride || globalThis.db || null;
  
  if (!db) {
    console.error('[cleanupScanningJobs] No database connection available');
    return { success: false, deletedCount: 0 };
  }
  
  try {
    // Count scanning jobs
    const scanningJobs = db.prepare('SELECT COUNT(*) as count FROM processing_jobs WHERE status = ?').get('scanning');
    console.log('[cleanupScanningJobs] Found', scanningJobs.count, 'scanning jobs in database');
    
    if (scanningJobs.count > 0) {
      // Delete scanning jobs directly
      const deleted = db.prepare('DELETE FROM processing_jobs WHERE status = ?').run('scanning');
      console.log('[cleanupScanningJobs] Successfully deleted', deleted.changes, 'scanning jobs from database');
      
      // Verify deletion
      const remainingJobs = db.prepare('SELECT COUNT(*) as count FROM processing_jobs WHERE status = ?').get('scanning');
      console.log('[cleanupScanningJobs] Remaining scanning jobs:', remainingJobs.count);
      
      return { success: true, deletedCount: deleted.changes };
    } else {
      console.log('[cleanupScanningJobs] No scanning jobs found to delete');
      return { success: true, deletedCount: 0 };
    }
  } catch (error) {
    console.error('[cleanupScanningJobs] Error cleaning scanning jobs:', error);
    return { success: false, deletedCount: 0, error: error.message };
  }
}

/**
 * Delete jobs from BullMQ/Redis and the DB (with temp file cleanup) for the given job IDs.
 * @param {Array<string|number>|object} jobIdsOrOptions
 * @param {object} dbOverride - The database instance to use (optional)
 * @returns {Promise<{deletedCount: number, failed: Array<string|number>}>}
 */
export async function deleteProcessingJobs(jobIdsOrOptions, dbOverride) {
  let jobIds = [];
  const db = dbOverride || globalThis.db || null;
  const BATCH_SIZE = 1000;

  // Add direct cleanup of scanning jobs
  if (db) {
    try {
      const scanningJobs = db.prepare('SELECT COUNT(*) as count FROM processing_jobs WHERE status = ?').get('scanning');
      console.log('[deleteProcessingJobs] Found', scanningJobs.count, 'scanning jobs in database');

      if (scanningJobs.count > 0) {
        console.log('[deleteProcessingJobs] Directly deleting scanning jobs from database');
        const deleted = db.prepare('DELETE FROM processing_jobs WHERE status = ?').run('scanning');
        console.log('[deleteProcessingJobs] Deleted', deleted.changes, 'scanning jobs from database');
      }
    } catch (dbError) {
      console.error('[deleteProcessingJobs] Error cleaning scanning jobs:', dbError);
    }
  }

  if (jobIdsOrOptions && jobIdsOrOptions.all) {
    // Fast path: pause workers, kill processes, remove all jobs from queues, flush Redis, then resume workers
    await pauseCpuWorkers();
    await pauseGpuWorkers();

    // Kill all running processes forcefully
    await killAllProcesses();

    // Remove all jobs from all queues before flushing Redis
    for (const [queueName, queue] of Object.entries(queues)) {
      try {
        // Get all jobs in all states
        const waiting = await queue.getWaiting();
        const active = await queue.getActive();
        const delayed = await queue.getDelayed();
        const completed = await queue.getCompleted();
        const failed = await queue.getFailed();

        // Remove all jobs from all states
        const allJobs = [...waiting, ...active, ...delayed, ...completed, ...failed];
        for (const job of allJobs) {
          try {
            await job.remove();
          } catch (removeErr) {
            // Ignore individual job removal errors
            logger.debug(`Failed to remove job ${job.id} from ${queueName}:`, removeErr.message);
          }
        }

        logger.info(`Removed ${allJobs.length} jobs from queue ${queueName}`);
      } catch (queueErr) {
        logger.warn(`Failed to clean queue ${queueName}:`, queueErr.message);
      }
    }

    // Small delay to ensure processes are killed and jobs are removed
    await new Promise((resolve) => setTimeout(resolve, 500));

    const redis = new Redis({ host: 'localhost', port: 6379 });
    await redis.flushdb();
    redis.disconnect();

    await resumeCpuWorkers();
    await resumeGpuWorkers();
    // Then batch delete all jobs from the DB
    const { getProcessingJobs, deleteProcessingJobsBatch: deleteProcessingJobsBatchLocal } =
      await import('../database/Db_Operations.js');
    jobIds = getProcessingJobs(db).map((job) => job.id);
    for (let i = 0; i < jobIds.length; i += BATCH_SIZE) {
      const batch = jobIds.slice(i, i + BATCH_SIZE);
      deleteProcessingJobsBatchLocal(db, batch);
    }
    return { deletedCount: jobIds.length, failed: [] };
  }
  if (Array.isArray(jobIdsOrOptions)) {
    jobIds = jobIdsOrOptions;
  } else if (jobIdsOrOptions && jobIdsOrOptions.jobIds) {
    jobIds = jobIdsOrOptions.jobIds;
  }
  let deletedCount = 0;
  const failed = [];
  for (let i = 0; i < jobIds.length; i += BATCH_SIZE) {
    const batch = jobIds.slice(i, i + BATCH_SIZE);
    // Remove from BullMQ/Redis and clean up temp files in parallel
    await Promise.allSettled(
      batch.map(async (jobId) => {
        try {
          await removeJobFromAllQueues(jobId);
          const jobIdInt = parseInt(jobId);
          if (!isNaN(jobIdInt)) {
            const jobDb = getProcessingJobById(db, jobIdInt);
            if (jobDb) {
              const tempFiles = [];
              if (jobDb.file_path) {
                const audioFileName =
                  path.basename(jobDb.file_path, path.extname(jobDb.file_path)) + '.wav';
                const audioPath = path.join(
                  globalThis.config?.tempDir || '',
                  'audio',
                  audioFileName,
                );
                tempFiles.push(audioPath);
                tempFiles.push(
                  path.join(globalThis.config?.tempDir || '', 'trimmed', `intro_${jobIdInt}.mp4`),
                  path.join(globalThis.config?.tempDir || '', 'trimmed', `credits_${jobIdInt}.mp4`),
                );
              }
              for (const file of tempFiles) {
                try {
                  await fs.unlink(file);
                  logger.info({ file }, 'Deleted temp file on job deletion');
                } catch (err) {
                  if (err.code !== 'ENOENT') {
                    logger.warn(
                      { file, error: err.message },
                      'Failed to delete temp file on job deletion',
                    );
                  }
                }
              }
            }
          }
          deletedCount++;
        } catch (err) {
          failed.push(jobId);
          logger.error(`Failed to delete job ${jobId}: ${err && err.message}`);
        }
      }),
    );
    // Batch delete from DB for this batch
    try {
      deleteProcessingJobsBatch(db, batch);
    } catch (err) {
      logger.error(`Failed to batch delete jobs from DB: ${err && err.message}`);
    }
  }
  return { deletedCount, failed };
}

/**
 * Deletes shows from the DB (with cascade), then finds and deletes all jobs related to those shows from BullMQ/Redis and the DB, and cleans up temp files.
 * @param {Array<string|number>} showIds
 * @param {object} db - The database instance
 * @returns {Promise<{deletedCount: number, failed: Array<string|number>}>}
 */
export async function deleteShowsAndCleanup(showIds, db) {
  if (!Array.isArray(showIds) || showIds.length === 0) {
    throw new Error('showIds must be a non-empty array');
  }
  // 1. Get all job IDs for these shows BEFORE deleting from DB
  const episodeFileAndJobIds = getEpisodeFileIdAndJobIdForShows(db, showIds);
  const jobIds = episodeFileAndJobIds
    .map((e) => e.dbJobId)
    .filter((id) => id !== null && id !== undefined);
  logger.info(
    `Cleaning up jobs for shows: ${showIds.join(', ')}. Found job IDs: ${jobIds.join(', ')}`,
  );

  // 2. Delete shows from DB (cascade will handle related tables)
  const { deleteShowsByIds } = await import('../database/Db_Operations.js');
  const deletedCount = deleteShowsByIds(db, showIds);

  // 3. Delete jobs from BullMQ/Redis and temp files
  const queue = queues['episode-processing'];
  const failed = [];
  for (const jobId of jobIds) {
    try {
      let job = await queue.getJob(jobId);
      if (!job) {
        const jobs = await queue.getJobs(
          ['active', 'waiting', 'completed', 'failed', 'delayed'],
          0,
          10000,
        );
        job = jobs.find((j) => j.data && String(j.data.dbJobId) === String(jobId));
      }
      if (job) {
        await job.remove();
      }
      // Temp file cleanup is not strictly needed since DB is gone, but can be added if desired
    } catch (err) {
      failed.push(jobId);
      logger.error(
        `Failed to delete job ${jobId} from BullMQ during show cleanup: ${err && err.message}`,
      );
    }
  }
  return { deletedCount, failed };
}

// Kill all running ffmpeg/fpcalc processes
async function killAllProcesses() {
  try {
    // Kill any ffmpeg processes that might be running
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

    logger.info('Killed all associated audio processing processes');
  } catch (error) {
    // It's okay if no processes were found to kill
    logger.debug('No audio processes to kill or error killing processes:', error.message);
  }
}
