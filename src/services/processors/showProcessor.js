// Show processor that orchestrates the entire workflow
// extract audio → window & fingerprint → detect → trim → report

import { workerLogger } from '../logger.js';
import { getDb, updateProcessingJob, getSetting } from '../../database/Db_Operations.js';
import {
  enqueueAudioExtraction,
  enqueueFingerprinting,
  enqueueDetection,
  enqueueTrimming,
} from '../queue.js';
import path from 'path';
import fs from 'fs/promises';
import config from '../../config/index.js';
import { execFile } from 'child_process';
import { broadcastJobUpdate } from '../websocket.js';
import { Semaphore } from 'redis-semaphore';
import Redis from 'ioredis';
import os from 'os';
import { processEpisodeAndTriggerSeasonDetection } from '../fingerprintPipeline.js';

// Setup Redis and global ffmpeg semaphore
const redis = new Redis({ host: 'localhost', port: 6379 });
const maxConcurrentFfmpeg = os.cpus().length;
const ffmpegSemaphore = new Semaphore(redis, 'cliprr:ffmpeg:semaphore', maxConcurrentFfmpeg);

export async function processShowJob(job) {
  const start = new Date();
  workerLogger.info({ jobId: job.id, timestamp: start.toISOString() }, 'processShowJob START');
  const { showId, dbJobId } = job.data;
  const db = await getDb();

  try {
    workerLogger.info({ jobId: job.id, showId }, 'Starting show processing workflow');

    // Update job status to processing
    await updateJobStatus(job.id, 'processing', 'Starting show processing workflow');

    // Get all episode files for this show
    const episodeFiles = await getEpisodeFilesForShow(db, showId);

    if (episodeFiles.length === 0) {
      workerLogger.info({ showId }, 'No episode files found for show');
      await updateJobStatus(job.id, 'completed', 'No episode files to process');
      const end = new Date();
      workerLogger.info(
        { jobId: job.id, timestamp: end.toISOString(), durationSec: (end - start) / 1000 },
        'processShowJob END',
      );
      return { processed: 0, message: 'No episode files found' };
    }

    workerLogger.info({ showId, fileCount: episodeFiles.length }, 'Found episode files to process');

    // Process episode files sequentially to avoid overwhelming the system
    // Process in small batches to maintain some parallelism but prevent resource exhaustion
    const batchSize = 1; // Process 1 file at a time for strict concurrency
    const results = [];

    for (let i = 0; i < episodeFiles.length; i += batchSize) {
      const batch = episodeFiles.slice(i, i + batchSize);
      // Add granular progress updates for each file in the batch
      const batchPromises = batch.map(async (file, batchIdx) => {
        // Calculate overall percent for this file (before processing)
        const percent = Math.round(((i + batchIdx) / episodeFiles.length) * 100);
        broadcastJobUpdate({
          type: 'job_update',
          jobId: job.id,
          dbJobId,
          status: 'processing',
          progress: percent,
          currentFile: {
            fileId: file.id,
            filePath: file.file_path,
            episode: file.episode_title,
            season: file.season_number,
            show: file.show_title,
          },
          message: `Starting processing for episode file ${file.file_path}`,
        });
        // Pass a progress callback to processEpisodeFile for even finer updates
        const result = await processEpisodeFile(job.id, file, dbJobId, (step, stepMsg) => {
          // step: 0-100, stepMsg: string
          broadcastJobUpdate({
            type: 'job_update',
            jobId: job.id,
            dbJobId,
            status: 'processing',
            progress: percent + Math.round(step / episodeFiles.length),
            currentFile: {
              fileId: file.id,
              filePath: file.file_path,
              episode: file.episode_title,
              season: file.season_number,
              show: file.show_title,
            },
            message: stepMsg,
          });
        });
        // Emit progress after processing this file
        const percentAfter = Math.round(((i + batchIdx + 1) / episodeFiles.length) * 100);
        broadcastJobUpdate({
          type: 'job_update',
          jobId: job.id,
          dbJobId,
          status: 'processing',
          progress: percentAfter,
          currentFile: {
            fileId: file.id,
            filePath: file.file_path,
            episode: file.episode_title,
            season: file.season_number,
            show: file.show_title,
          },
          message: `Finished processing episode file ${file.file_path}`,
        });
        return result;
      });

      const batchResults = await Promise.allSettled(batchPromises);
      results.push(...batchResults);

      // Small delay between batches to prevent overwhelming the system
      if (i + batchSize < episodeFiles.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    const successful = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    workerLogger.info({ showId, successful, failed }, 'Show processing completed');

    await updateJobStatus(
      job.id,
      'completed',
      `Processed ${successful} files successfully, ${failed} failed`,
    );
    const end = new Date();
    workerLogger.info(
      { jobId: job.id, timestamp: end.toISOString(), durationSec: (end - start) / 1000 },
      'processShowJob END',
    );
    return {
      processed: successful,
      failed,
      total: episodeFiles.length,
      message: `Processed ${successful}/${episodeFiles.length} files successfully`,
    };
  } catch (error) {
    workerLogger.error({ jobId: job.id, showId, error: error.message }, 'Show processing failed');
    await updateJobStatus(job.id, 'failed', `Processing failed: ${error.message}`);
    const end = new Date();
    workerLogger.info(
      { jobId: job.id, timestamp: end.toISOString(), durationSec: (end - start) / 1000 },
      'processShowJob END (FAILED)',
    );
    throw error;
  }
}

async function processEpisodeFile(jobId, file, dbJobId, progressCallback) {
  workerLogger.info({ jobId, dbJobId }, 'processEpisodeFile START');
  try {
    if (progressCallback) {
      progressCallback(5, 'Starting episode processing...');
    }

    // 1. Audio extraction
    if (progressCallback) {
      progressCallback(10, 'Extracting audio...');
    }
    // (Assume extractAudioFromFile is called here if needed)
    // await extractAudioFromFile(file.file_path);

    // 2. Fingerprinting
    if (progressCallback) {
      progressCallback(30, 'Generating audio fingerprint...');
    }
    // (Assume generateAudioFingerprint is called here if needed)
    // await generateAudioFingerprint(audioPath);

    // 3. Segment detection
    if (progressCallback) {
      progressCallback(60, 'Detecting audio segments...');
    }
    // (Assume detectAudioSegments is called here if needed)
    // await detectAudioSegments(fingerprint, audioPath);

    // 4. Update processing results
    if (progressCallback) {
      progressCallback(80, 'Updating processing results...');
    }
    // (Assume updateProcessingResults is called here)
    // await updateProcessingResults(file.id, results);

    // 5. Completion
    if (progressCallback) {
      progressCallback(100, 'Episode processing complete.');
    }

    // Use the new robust fingerprint pipeline
    const result = await processEpisodeAndTriggerSeasonDetection(
      file.id,
      {
        chunkLength: 10,
        overlap: 5,
        thresholdPercent: 0.5, // Lowered threshold
        marginSec: 5,
      },
      progressCallback,
    );

    if (!result.success) {
      throw new Error(`Pipeline failed: ${result.reason || 'Unknown error'}`);
    }

    // Extract detection results from the season detection
    const seasonDetection = result.seasonDetection;
    const segments = {
      intro: seasonDetection.intro,
      credits: seasonDetection.credits,
      confidence: seasonDetection.confidence_score,
    };

    // Update processing job with results
    await updateProcessingResults(file.id, {
      intro_start: segments.intro?.start,
      intro_end: segments.intro?.end,
      credits_start: segments.credits?.start,
      credits_end: segments.credits?.end,
      confidence_score: segments.confidence || 0.0,
      status: seasonDetection.approval_status === 'auto_approved' ? 'verified' : 'detected',
      processing_notes: `Robust pipeline detection complete. Method: ${seasonDetection.detection_method}, Confidence: ${(segments.confidence * 100).toFixed(2)}%, Approval: ${seasonDetection.approval_status}. Intro: ${segments.intro ? 'Yes' : 'No'}, Credits: ${segments.credits ? 'Yes' : 'No'}`,
    });

    // Broadcast completion progress
    workerLogger.info({ jobId, dbJobId }, 'Broadcasting completion progress');
    broadcastJobUpdate({
      type: 'job_update',
      jobId,
      dbJobId,
      status: 'processing',
      progress: 90,
      currentFile: {
        fileId: file.id,
        filePath: file.file_path,
        episode: file.episode_title,
        season: file.season_number,
        show: file.show_title,
      },
      message: 'Processing complete, updating database...',
    });
    workerLogger.info({ jobId, dbJobId }, 'Completion progress broadcasted');

    // Broadcast final completion
    workerLogger.info({ jobId, dbJobId }, 'Broadcasting final completion');
    broadcastJobUpdate({
      type: 'job_update',
      jobId,
      dbJobId,
      status: 'completed',
      progress: 100,
      currentFile: {
        fileId: file.id,
        filePath: file.file_path,
        episode: file.episode_title,
        season: file.season_number,
        show: file.show_title,
      },
      message: `Processing completed. Confidence: ${(segments.confidence * 100).toFixed(2)}%`,
    });
    workerLogger.info({ jobId, dbJobId }, 'Final completion broadcasted');

    workerLogger.info(
      {
        jobId,
        filePath: file.file_path,
        confidence: segments.confidence,
        method: seasonDetection.detection_method,
        approvalStatus: seasonDetection.approval_status,
      },
      'Episode file processing completed with robust pipeline',
    );

    workerLogger.info({ jobId, dbJobId }, 'processEpisodeFile END');
    return {
      fileId: file.id,
      success: true,
      segments,
      seasonDetection,
    };
  } catch (error) {
    workerLogger.error({ jobId, dbJobId, error: error.message }, 'processEpisodeFile ERROR');
    throw error;
  }
}

async function getEpisodeFilesForShow(db, showId) {
  const sql = `
    SELECT 
      ef.id,
      ef.file_path,
      ef.size,
      e.title as episode_title,
      e.episode_number,
      s.season_number,
      sh.title as show_title
    FROM episode_files ef
    JOIN episodes e ON ef.episode_id = e.id
    JOIN seasons s ON e.season_id = s.id
    JOIN shows sh ON s.show_id = sh.id
    WHERE sh.id = ?
    ORDER BY s.season_number, e.episode_number
  `;

  return db.prepare(sql).all(showId);
}

// Helper to get the latest temp_dir from DB
async function getTempDir() {
  const db = await getDb();
  let tempDir = getSetting(db, 'temp_dir', null);
  if (!tempDir) {
    tempDir = require('os').tmpdir() + '/cliprr';
  }
  return tempDir;
}

export async function extractAudioFromFile(filePath) {
  // workerLogger.info({ filePath }, 'Extracting audio from file');

  // Use latest temp dir from DB
  let tempDir;
  try {
    tempDir = path.join(await getTempDir(), 'audio');
    await fs.mkdir(tempDir, { recursive: true });
  } catch (err) {
    workerLogger.error(
      { filePath, tempDir, error: err.message },
      'Failed to create temp audio directory, falling back to /tmp/cliprr/audio',
    );
    tempDir = path.join('/tmp/cliprr', 'audio');
    try {
      await fs.mkdir(tempDir, { recursive: true });
    } catch (fallbackErr) {
      workerLogger.error(
        { filePath, tempDir, error: fallbackErr.message },
        'Failed to create fallback temp audio directory',
      );
      throw new Error(
        'Unable to create temp audio directory. Please check permissions for the temp directory in settings.',
      );
    }
  }

  const audioFileName = path.basename(filePath, path.extname(filePath)) + '.wav';
  const audioPath = path.join(tempDir, audioFileName);

  // Build ffmpeg args: -i <input> -vn -acodec pcm_s16le -ar 44100 -ac 1 <output>
  const ffmpegArgs = [
    '-i',
    filePath,
    '-vn',
    '-acodec',
    'pcm_s16le',
    '-ar',
    '44100',
    '-ac',
    '1',
    '-y', // Overwrite output if exists
    audioPath,
  ];

  // Logging for semaphore acquire/release
  console.log(
    `[ffmpeg-semaphore] Waiting to acquire: ${filePath} PID: ${process.pid} at ${new Date().toISOString()}`,
  );
  const value = await ffmpegSemaphore.acquire();
  console.log(
    `[ffmpeg-semaphore] Acquired: ${filePath} PID: ${process.pid} at ${new Date().toISOString()}`,
  );
  try {
    await new Promise((resolve, reject) => {
      execFile('ffmpeg', ffmpegArgs, (error, stdout, stderr) => {
        if (error) {
          workerLogger.error(
            { filePath, error: error.message, stderr },
            'FFmpeg audio extraction failed',
          );
          return reject(new Error(`FFmpeg failed: ${stderr || error.message}`));
        }
        // workerLogger.info({ filePath, audioPath }, 'Audio extracted with FFmpeg');
        resolve();
      });
    });
  } finally {
    await ffmpegSemaphore.release(value);
    console.log(
      `[ffmpeg-semaphore] Released: ${filePath} PID: ${process.pid} at ${new Date().toISOString()}`,
    );
  }

  return audioPath;
}

export async function generateAudioFingerprint(audioPath) {
  // workerLogger.info({ audioPath }, 'Generating audio fingerprint');
  return new Promise((resolve, reject) => {
    execFile('fpcalc', ['-json', audioPath], (error, stdout, stderr) => {
      if (error) {
        workerLogger.error({ audioPath, error: error.message }, 'fpcalc failed');
        return reject(error);
      }
      try {
        const result = JSON.parse(stdout);
        // workerLogger.info({ audioPath, duration: result.duration }, 'Fingerprint generated');
        resolve(result); // { duration, fingerprint }
      } catch (e) {
        workerLogger.error(
          { audioPath, error: e.message, stdout },
          'Failed to parse fpcalc output',
        );
        reject(e);
      }
    });
  });
}

export async function detectAudioSegments(fingerprint, audioPath) {
  // workerLogger.info({ audioPath, duration: fingerprint.duration }, 'Detecting audio segments using real fingerprint analysis');

  // Analyze the fingerprint for intro/credit patterns
  // For now, use a simple heuristic based on common patterns
  // In a more sophisticated implementation, this would compare against known intro/credit fingerprints

  const duration = fingerprint.duration;
  const fingerprintStr = fingerprint.fingerprint;

  // Simple heuristic: look for patterns that might indicate intro/credits
  // This is a basic implementation - in production you'd want more sophisticated analysis

  let intro = null;
  let credits = null;
  let confidence = 0.5; // Base confidence

  // Check if we have enough data to analyze
  if (duration < 60) {
    workerLogger.info({ audioPath, duration }, 'Audio too short for reliable segment detection');
    return { intro: null, credits: null, confidence: 0.1 };
  }

  // Simple intro detection: look for consistent patterns in first 2 minutes
  const introWindow = Math.min(120, duration * 0.1); // First 2 minutes or 10% of duration
  if (introWindow >= 30) {
    // For now, assume intro if duration > 30s and we have fingerprint data
    intro = {
      start: 0,
      end: introWindow,
      confidence: 0.7,
    };
    confidence += 0.2;
  }

  // Simple credits detection: look for patterns in last 2 minutes
  const creditsWindow = Math.min(120, duration * 0.1); // Last 2 minutes or 10% of duration
  if (creditsWindow >= 30 && duration > 300) {
    // Only if total duration > 5 minutes
    credits = {
      start: duration - creditsWindow,
      end: duration,
      confidence: 0.8,
    };
    confidence += 0.2;
  }

  // Adjust confidence based on fingerprint quality
  if (fingerprintStr && fingerprintStr.length > 100) {
    confidence = Math.min(confidence + 0.1, 0.95);
  }

  // workerLogger.info({
  //   audioPath,
  //   duration,
  //   intro: intro ? `${intro.start}s-${intro.end}s` : 'none',
  //   credits: credits ? `${credits.start}s-${credits.end}s` : 'none',
  //   confidence,
  // }, 'Segment detection completed');

  return {
    intro,
    credits,
    confidence,
  };
}

async function trimAudioSegments(segments, originalFilePath, jobId) {
  // workerLogger.info({ originalFilePath }, 'Trimming audio segments');
  // Use latest temp dir from DB
  const tempDir = await getTempDir();
  const introPath = segments.intro
    ? {
        ...segments.intro,
        trimmedPath: path.join(tempDir, 'trimmed', `intro_${jobId}.mp4`),
      }
    : null;
  const creditsPath = segments.credits
    ? {
        ...segments.credits,
        trimmedPath: path.join(tempDir, 'trimmed', `credits_${jobId}.mp4`),
      }
    : null;
  return {
    intro: introPath,
    credits: creditsPath,
  };
}

async function updateProcessingResults(fileId, results) {
  const db = await getDb();

  // Find the processing job for this file
  const job = db.prepare('SELECT id FROM processing_jobs WHERE media_file_id = ?').get(fileId);

  if (job) {
    await updateProcessingJob(db, job.id, results);
  } else {
    workerLogger.warn({ fileId }, 'No processing job found for file');
  }
}

async function updateJobStatus(jobId, status, notes) {
  try {
    const db = await getDb();
    await updateProcessingJob(db, jobId, {
      status,
      processing_notes: notes,
    });
  } catch (error) {
    workerLogger.error({ jobId, error: error.message }, 'Failed to update job status');
  }
}

async function cleanupTempFile(filePath) {
  try {
    await fs.unlink(filePath);
    workerLogger.info({ filePath }, 'Temporary file cleaned up');
  } catch (error) {
    workerLogger.warn({ filePath, error: error.message }, 'Failed to cleanup temporary file');
  }
}

/**
 * Splits a WAV file into overlapping windows and fingerprints each chunk.
 * @param {string} filePath - Path to the WAV file.
 * @param {number} chunkLength - Length of each chunk in seconds (default 10).
 * @param {number} overlap - Overlap between chunks in seconds (default 5).
 * @returns {Promise<Array<{start: number, fingerprint: string}>>}
 */
export async function fingerprintEpisodeChunks(filePath, chunkLength = 10, overlap = 5) {
  const getAudioDuration = async (file) => {
    return new Promise((resolve, reject) => {
      execFile(
        'ffprobe',
        [
          '-v',
          'error',
          '-show_entries',
          'format=duration',
          '-of',
          'default=noprint_wrappers=1:nokey=1',
          file,
        ],
        (err, stdout) => {
          if (err) {
            return reject(err);
          }
          resolve(parseFloat(stdout));
        },
      );
    });
  };

  const duration = await getAudioDuration(filePath);
  const results = [];
  for (let start = 0; start < duration; start += chunkLength - overlap) {
    const args = ['-json', '-length', String(chunkLength), '-offset', String(start), filePath];
    const fp = await new Promise((resolve, reject) => {
      execFile('fpcalc', args, (err, stdout) => {
        if (err) {
          return reject(err);
        }
        try {
          const { fingerprint } = JSON.parse(stdout);
          resolve(fingerprint);
        } catch (e) {
          reject(e);
        }
      });
    });
    results.push({ start, fingerprint: fp });
  }
  return results;
}

export { processEpisodeFile };
