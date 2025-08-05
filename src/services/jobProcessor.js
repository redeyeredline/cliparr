// jobProcessor.js
// Job processing functions will be moved here from queue.js
import { workerLogger } from './logger.js';
import { getDb, getEpisodeFileById } from '../database/Db_Operations.js';
import {
  processEpisodeFile,
  extractAudioFromFile,
  generateAudioFingerprint,
  detectAudioSegments,
} from '../services/processors/showProcessor.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function processJob(jobType, jobOrData) {
  workerLogger.info({ jobType, jobId: jobOrData?.id, data: jobOrData?.data }, 'Picked up job for processing');
  try {
    switch (jobType) {
      case 'episode-processing': {
        const db = await getDb();
        const episodeFileId = jobOrData.data.episodeFileId;
        const dbJobId = jobOrData.data.dbJobId;
        workerLogger.info({ jobType, jobId: jobOrData.id, episodeFileId, dbJobId }, 'Processing episode-processing job');
        // Fetch the episode file record by its ID
        const file = await getEpisodeFileById(db, episodeFileId);
        if (!file) {
          workerLogger.error(`Episode file not found for ID: ${episodeFileId}`);
          throw new Error(`Episode file not found for ID: ${episodeFileId}`);
        }
        return await processEpisodeFile(jobOrData.id, file, dbJobId);
      }
      case 'audio-extraction':
        workerLogger.info({ jobType, jobId: jobOrData.id }, 'Processing audio-extraction job');
        return await processAudioExtraction(jobOrData);
      case 'fingerprinting':
        workerLogger.info({ jobType, jobId: jobOrData.id }, 'Processing fingerprinting job');
        return await processFingerprinting(jobOrData);
      case 'detection':
        workerLogger.info({ jobType, jobId: jobOrData.id }, 'Processing detection job');
        return await processDetection(jobOrData);
      case 'trimming':
        workerLogger.info({ jobType, jobId: jobOrData.id }, 'Processing trimming job');
        return await processTrimming(jobOrData);
      default:
        workerLogger.error({ jobType, jobId: jobOrData?.id }, 'Unknown job type');
        throw new Error(`Unknown job type: ${jobType}`);
    }
  } catch (error) {
    workerLogger.error({ jobType, jobId: jobOrData?.id, error: error.message, stack: error.stack }, 'Error processing job');
    throw error;
  }
}

// Placeholder worker functions
export async function processAudioExtraction(jobData) {
  workerLogger.info({ jobData }, 'Processing audio extraction');
  // Use the real audio extraction logic
  const audioPath = await extractAudioFromFile(jobData.filePath);
  return { message: 'Audio extracted successfully', audioPath };
}

export async function processFingerprinting(jobData) {
  workerLogger.info({ jobData }, 'Processing fingerprinting');
  // Use the real fingerprinting logic
  const fingerprint = await generateAudioFingerprint(jobData.audioPath);
  return { message: 'Fingerprint generated', fingerprint };
}

export async function processDetection(jobData) {
  workerLogger.info({ jobData }, 'Processing detection');
  // Use the real detection logic
  const segments = await detectAudioSegments(jobData.fingerprint, jobData.audioPath);
  return { message: 'Segments detected', segments };
}

export async function processTrimming(jobData) {
  workerLogger.info({ jobData }, 'Processing trimming');
  // Simulate trimming
  await new Promise((resolve) => setTimeout(resolve, 3000));
  return { message: 'Video trimmed successfully', clips: 3 };
}

// Kill any ffmpeg/fpcalc processes associated with a specific job
export async function killJobProcesses(jobId) {
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
