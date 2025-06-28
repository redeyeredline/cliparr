// Show processor that orchestrates the entire workflow
// extract audio → window & fingerprint → detect → trim → report

import { logger } from '../logger.js';
import { getDb, updateProcessingJob } from '../../database/Db_Operations.js';
import {
  enqueueAudioExtraction,
  enqueueFingerprinting,
  enqueueDetection,
  enqueueTrimming,
} from '../queue.js';
import path from 'path';
import fs from 'fs/promises';

export async function processShowJob(job) {
  console.log('processShowJob received job:', job);
  console.log('processShowJob received job.data:', job && job.data);
  const { showId } = job.data;
  const db = await getDb();

  try {
    logger.info({ jobId: job.id, showId }, 'Starting show processing workflow');

    // Update job status to processing
    await updateJobStatus(job.id, 'processing', 'Starting show processing workflow');

    // Get all episode files for this show
    const episodeFiles = await getEpisodeFilesForShow(db, showId);

    if (episodeFiles.length === 0) {
      logger.info({ showId }, 'No episode files found for show');
      await updateJobStatus(job.id, 'completed', 'No episode files to process');
      return { processed: 0, message: 'No episode files found' };
    }

    logger.info({ showId, fileCount: episodeFiles.length }, 'Found episode files to process');

    // Process each episode file
    const processingPromises = episodeFiles.map(async (file) => {
      return await processEpisodeFile(job.id, file);
    });

    const results = await Promise.allSettled(processingPromises);

    const successful = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    logger.info({ showId, successful, failed }, 'Show processing completed');

    await updateJobStatus(job.id, 'completed', `Processed ${successful} files successfully, ${failed} failed`);

    return {
      processed: successful,
      failed,
      total: episodeFiles.length,
      message: `Processed ${successful}/${episodeFiles.length} files successfully`,
    };

  } catch (error) {
    logger.error({ jobId: job.id, showId, error: error.message }, 'Show processing failed');
    await updateJobStatus(job.id, 'failed', `Processing failed: ${error.message}`);
    throw error;
  }
}

async function processEpisodeFile(jobId, file) {
  try {
    logger.info({ jobId, filePath: file.file_path }, 'Processing episode file');

    // Step 1: Extract audio
    const audioPath = await extractAudioFromFile(file.file_path);

    // Step 2: Generate fingerprint
    const fingerprint = await generateAudioFingerprint(audioPath);

    // Step 3: Detect segments
    const segments = await detectAudioSegments(fingerprint, audioPath);

    // Step 4: Trim segments
    const trimmedSegments = await trimAudioSegments(segments, file.file_path);

    // Step 5: Update database with results
    await updateProcessingResults(file.id, {
      intro_start: segments.intro?.start,
      intro_end: segments.intro?.end,
      credits_start: segments.credits?.start,
      credits_end: segments.credits?.end,
      confidence_score: segments.confidence || 0.0,
      status: 'completed',
      processing_notes: `Processed successfully. Intro: ${segments.intro ? 'Yes' : 'No'}, Credits: ${segments.credits ? 'Yes' : 'No'}`,
    });

    // Cleanup temporary audio file
    await cleanupTempFile(audioPath);

    logger.info({ jobId, filePath: file.file_path }, 'Episode file processing completed');

    return {
      fileId: file.id,
      success: true,
      segments,
    };

  } catch (error) {
    logger.error({ jobId, filePath: file.file_path, error: error.message }, 'Episode file processing failed');

    // Update database with failure
    await updateProcessingResults(file.id, {
      status: 'failed',
      processing_notes: `Processing failed: ${error.message}`,
    });

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

async function extractAudioFromFile(filePath) {
  // For now, we'll use a placeholder implementation
  // In a real implementation, this would use FFmpeg to extract audio
  logger.info({ filePath }, 'Extracting audio from file');

  // Simulate audio extraction
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Return a temporary audio file path
  const tempDir = '/tmp/cliprr/audio';
  await fs.mkdir(tempDir, { recursive: true });

  const audioFileName = path.basename(filePath, path.extname(filePath)) + '.wav';
  const audioPath = path.join(tempDir, audioFileName);

  // Create a dummy audio file for now
  await fs.writeFile(audioPath, 'dummy audio data');

  return audioPath;
}

async function generateAudioFingerprint(audioPath) {
  // For now, we'll use a placeholder implementation
  // In a real implementation, this would use Chromaprint/AcoustID
  logger.info({ audioPath }, 'Generating audio fingerprint');

  // Simulate fingerprinting
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Return a dummy fingerprint
  return {
    fingerprint: 'dummy_fingerprint_data',
    duration: 3600, // 1 hour in seconds
    sampleRate: 44100,
  };
}

async function detectAudioSegments(fingerprint, audioPath) {
  // For now, we'll use a placeholder implementation
  // In a real implementation, this would analyze the fingerprint for patterns
  logger.info({ audioPath }, 'Detecting audio segments');

  // Simulate detection
  await new Promise((resolve) => setTimeout(resolve, 1500));

  // Return dummy segments
  const hasIntro = Math.random() > 0.3; // 70% chance of having intro
  const hasCredits = Math.random() > 0.2; // 80% chance of having credits

  return {
    intro: hasIntro ? {
      start: 0,
      end: 90, // 1:30 intro
      confidence: 0.85,
    } : null,
    credits: hasCredits ? {
      start: fingerprint.duration - 120, // Last 2 minutes
      end: fingerprint.duration,
      confidence: 0.92,
    } : null,
    confidence: Math.random() * 0.3 + 0.7, // 70-100% confidence
  };
}

async function trimAudioSegments(segments, originalFilePath) {
  // For now, we'll use a placeholder implementation
  // In a real implementation, this would use FFmpeg to trim the segments
  logger.info({ originalFilePath }, 'Trimming audio segments');

  // Simulate trimming
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Return the trimmed segments info
  return {
    intro: segments.intro ? {
      ...segments.intro,
      trimmedPath: `/tmp/cliprr/trimmed/intro_${Date.now()}.mp4`,
    } : null,
    credits: segments.credits ? {
      ...segments.credits,
      trimmedPath: `/tmp/cliprr/trimmed/credits_${Date.now()}.mp4`,
    } : null,
  };
}

async function updateProcessingResults(fileId, results) {
  const db = await getDb();

  // Find the processing job for this file
  const job = db.prepare('SELECT id FROM processing_jobs WHERE media_file_id = ?').get(fileId);

  if (job) {
    await updateProcessingJob(db, job.id, results);
  } else {
    logger.warn({ fileId }, 'No processing job found for file');
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
    logger.error({ jobId, error: error.message }, 'Failed to update job status');
  }
}

async function cleanupTempFile(filePath) {
  try {
    await fs.unlink(filePath);
    logger.info({ filePath }, 'Temporary file cleaned up');
  } catch (error) {
    logger.warn({ filePath, error: error.message }, 'Failed to cleanup temporary file');
  }
}
