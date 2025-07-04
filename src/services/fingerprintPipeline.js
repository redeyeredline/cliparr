import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { execFile, spawn } from 'child_process';
import lodash from 'lodash';
import { v4 as uuidv4 } from 'uuid';
import { workerLogger } from './logger.js';
import { getDb, getSetting, setSetting } from '../database/Db_Operations.js';

const { meanBy, ceil, round } = lodash;

/**
 * Enhanced fingerprint pipeline for robust intro/credits detection
 * Features:
 * - Per-season batch processing with cross-season fallback
 * - High-precision confidence scores (0.00-1.00)
 * - Smart data preservation to prevent accidental data loss
 * - File state analysis to detect already-processed files
 * - Detailed logging for development and debugging
 */

// Track active ffmpeg jobs for UI progress
export const activeFfmpegJobs = {};

// Database schema for fingerprint storage
const FINGERPRINT_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS episode_fingerprints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    show_id INTEGER NOT NULL,
    season_number INTEGER NOT NULL,
    episode_number INTEGER NOT NULL,
    episode_file_id INTEGER NOT NULL,
    fingerprint_data TEXT NOT NULL,
    file_duration REAL NOT NULL,
    file_size INTEGER NOT NULL,
    is_valid BOOLEAN DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (episode_file_id) REFERENCES episode_files(id) ON DELETE CASCADE,
    UNIQUE(show_id, season_number, episode_number, episode_file_id)
  )`,
  `CREATE TABLE IF NOT EXISTS detection_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    show_id INTEGER NOT NULL,
    season_number INTEGER NOT NULL,
    episode_number INTEGER NOT NULL,
    episode_file_id INTEGER NOT NULL,
    intro_start REAL,
    intro_end REAL,
    credits_start REAL,
    credits_end REAL,
    stingers_data TEXT,
    segments_data TEXT,
    confidence_score REAL NOT NULL,
    detection_method TEXT NOT NULL,
    approval_status TEXT DEFAULT 'pending',
    processing_notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (episode_file_id) REFERENCES episode_files(id) ON DELETE CASCADE,
    UNIQUE(show_id, season_number, episode_number, episode_file_id)
  )`,
  'CREATE INDEX IF NOT EXISTS idx_episode_fingerprints_show_season ON episode_fingerprints(show_id, season_number)',
  'CREATE INDEX IF NOT EXISTS idx_episode_fingerprints_valid ON episode_fingerprints(is_valid)',
  'CREATE INDEX IF NOT EXISTS idx_detection_results_show_season ON detection_results(show_id, season_number)',
  'CREATE INDEX IF NOT EXISTS idx_detection_results_approval ON detection_results(approval_status)',
];

// Initialize database schema
export async function initializeFingerprintSchema() {
  const db = await getDb();
  for (const statement of FINGERPRINT_SCHEMA) {
    db.prepare(statement).run();
  }
  workerLogger.info('Fingerprint database schema initialized');
}

/**
 * Analyze file state to detect if it appears to be already processed
 */
async function analyzeFileState(filePath) {
  try {
    const stats = await fsp.stat(filePath);
    const fileSize = stats.size;

    // Get video duration using ffprobe
    const duration = await new Promise((resolve, reject) => {
      execFile('ffprobe', [
        '-v', 'error',
        '-show_entries', 'format=duration',
        '-of', 'default=noprint_wrappers=1:nokey=1',
        filePath,
      ], (err, stdout) => {
        if (err) {
          return reject(err);
        }
        resolve(parseFloat(stdout));
      });
    });

    // Basic heuristics for already-processed files
    const isAlreadyProcessed = {
      fileSize: fileSize,
      duration: duration,
      indicators: [],
    };

    // Check for typical signs of already-processed files
    if (duration < 300) { // Less than 5 minutes
      isAlreadyProcessed.indicators.push('short_duration');
    }

    // Check file size relative to duration (rough heuristic)
    const bytesPerSecond = fileSize / duration;
    if (bytesPerSecond < 100000) { // Very low bitrate
      isAlreadyProcessed.indicators.push('low_bitrate');
    }

    return isAlreadyProcessed;
  } catch (error) {
    workerLogger.error({ filePath, error: error.message }, 'File state analysis failed');
    return { fileSize: 0, duration: 0, indicators: [] };
  }
}

/**
 * Extract audio from video file using ffmpeg, normalize, and band-pass filter (combined)
 */
async function extractAudioFromFile(filePath, tempDir, episodeFileId) {
  const baseName = path.basename(filePath, path.extname(filePath));
  const filteredPath = path.join(tempDir, baseName + '.filtered.wav');

  // Use a simpler, more robust filter chain that's less likely to fail
  // Basic normalization and band-pass filtering without complex loudnorm
  const filterChain = 'aresample=44100,pan=mono|c0=.5*c0+.5*c1,highpass=f=300,lowpass=f=3000,volume=1.5';
  const ffmpegArgs = [
    '-i', filePath,
    '-af', filterChain,
    '-acodec', 'pcm_s16le',
    '-ar', '44100',
    '-ac', '1',
    '-y',
    filteredPath,
  ];

  // Get total duration using ffprobe
  const getDuration = async (file) => {
    return new Promise((resolve, reject) => {
      execFile('ffprobe', [
        '-v', 'error',
        '-show_entries', 'format=duration',
        '-of', 'default=noprint_wrappers=1:nokey=1',
        file,
      ], (err, stdout) => {
        if (err) {
          return reject(err);
        }
        resolve(parseFloat(stdout));
      });
    });
  };
  let totalDuration = 0;
  try {
    totalDuration = await getDuration(filePath);
  } catch (e) {
    workerLogger.warn({ filePath, error: e.message }, 'Failed to get duration for audio extraction progress');
  }

  const t0 = Date.now();
  let lastPercent = 0;
  try {
    await new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', ffmpegArgs);
      let stderr = '';
      ffmpeg.stderr.on('data', (data) => {
        const str = data.toString();
        stderr += str;
        // Parse ffmpeg progress lines
        const timeMatch = str.match(/time=([0-9:.]+)/);
        if (timeMatch && totalDuration > 0) {
          // Convert time to seconds
          const parts = timeMatch[1].split(':');
          let seconds = 0;
          if (parts.length === 3) {
            seconds = (+parts[0]) * 3600 + (+parts[1]) * 60 + parseFloat(parts[2]);
          } else if (parts.length === 2) {
            seconds = (+parts[0]) * 60 + parseFloat(parts[1]);
          } else {
            seconds = parseFloat(parts[0]);
          }
          const percent = Math.min(100, Math.round((seconds / totalDuration) * 100));
          if (percent !== lastPercent) {
            lastPercent = percent;
            workerLogger.info({ filePath, episodeFileId, percent }, `Audio extraction progress: ${percent}%`);
            if (typeof broadcastJobUpdate === 'function' && episodeFileId) {
              broadcastJobUpdate({
                episodeFileId,
                filePath,
                percent,
                status: `extracting (${percent}%)`,
                type: 'audio-extraction-progress',
              });
            }
          }
        }
      });
      ffmpeg.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          const truncatedStderr = stderr ? stderr.split('\n').slice(0, 5).join('\n') : '';
          workerLogger.error({ filePath, error: `ffmpeg exited with code ${code}`, stderr: truncatedStderr }, 'FFmpeg audio extraction failed');
          reject(new Error(`FFmpeg audio extraction failed: ${truncatedStderr || 'Unknown error'}`));
        }
      });
      ffmpeg.on('error', (err) => {
        workerLogger.error({ filePath, error: err.message }, 'FFmpeg process error during audio extraction');
        reject(err);
      });
    });
  } catch (extractionError) {
    // Fallback to even simpler extraction if the first attempt fails
    workerLogger.warn({ filePath, error: extractionError.message }, 'Primary audio extraction failed, trying fallback method');
    const fallbackArgs = [
      '-i', filePath,
      '-vn',
      '-acodec', 'pcm_s16le',
      '-ar', '44100',
      '-ac', '1',
      '-y',
      filteredPath,
    ];
    await new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', fallbackArgs);
      let stderr = '';
      ffmpeg.stderr.on('data', (data) => {
        const str = data.toString();
        stderr += str;
        const timeMatch = str.match(/time=([0-9:.]+)/);
        if (timeMatch && totalDuration > 0) {
          const parts = timeMatch[1].split(':');
          let seconds = 0;
          if (parts.length === 3) {
            seconds = (+parts[0]) * 3600 + (+parts[1]) * 60 + parseFloat(parts[2]);
          } else if (parts.length === 2) {
            seconds = (+parts[0]) * 60 + parseFloat(parts[1]);
          } else {
            seconds = parseFloat(parts[0]);
          }
          const percent = Math.min(100, Math.round((seconds / totalDuration) * 100));
          if (percent !== lastPercent) {
            lastPercent = percent;
            workerLogger.info({ filePath, episodeFileId, percent }, `Audio extraction progress: ${percent}%`);
            if (typeof broadcastJobUpdate === 'function' && episodeFileId) {
              broadcastJobUpdate({
                episodeFileId,
                filePath,
                percent,
                status: `extracting (${percent}%)`,
                type: 'audio-extraction-progress',
              });
            }
          }
        }
      });
      ffmpeg.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          const truncatedStderr = stderr ? stderr.split('\n').slice(0, 5).join('\n') : '';
          workerLogger.error({ filePath, error: `ffmpeg exited with code ${code}`, stderr: truncatedStderr }, 'FFmpeg fallback audio extraction failed');
          reject(new Error(`FFmpeg fallback audio extraction failed: ${truncatedStderr || 'Unknown error'}`));
        }
      });
      ffmpeg.on('error', (err) => {
        workerLogger.error({ filePath, error: err.message }, 'FFmpeg process error during fallback audio extraction');
        reject(err);
      });
    });
  }

  const t1 = Date.now();
  workerLogger.info({ filePath, durationMs: t1 - t0 }, 'Audio extraction complete');

  // Emit 100% progress at the end
  if (typeof broadcastJobUpdate === 'function' && episodeFileId) {
    broadcastJobUpdate({
      episodeFileId,
      filePath,
      percent: 100,
      status: 'extracting (100%)',
      type: 'audio-extraction-progress',
    });
  }

  // Verify the output file exists and has content
  try {
    const stats = await fsp.stat(filteredPath);
    if (stats.size === 0) {
      throw new Error('Extracted audio file is empty');
    }
  } catch (error) {
    workerLogger.error({ filePath, filteredPath, error: error.message }, 'Audio extraction verification failed');
    throw new Error(`Audio extraction failed: ${error.message}`);
  }

  return filteredPath;
}

/**
 * Generate fingerprints for sliding windows in an audio file
 */
async function fingerprintEpisodeChunks(filePath, chunkLength = 30, overlap = 20, episodeFileId = null, progressCallback = null) {
  const getAudioDuration = async (file) => {
    return new Promise((resolve, reject) => {
      execFile('ffprobe', [
        '-v', 'error',
        '-show_entries', 'format=duration',
        '-of', 'default=noprint_wrappers=1:nokey=1',
        file,
      ], (err, stdout) => {
        if (err) {
          return reject(err);
        }
        resolve(parseFloat(stdout));
      });
    });
  };

  const duration = await getAudioDuration(filePath);
  const results = [];
  const tempDir = path.dirname(filePath);
  const totalChunks = Math.ceil(duration / (chunkLength - overlap));

  const tChunkStart = Date.now();
  for (let i = 0, start = 0; start < duration; i++, start += (chunkLength - overlap)) {
    const chunkFileName = `chunk_${start}_${Date.now()}.wav`;
    const chunkPath = path.join(tempDir, chunkFileName);
    const tChunk = Date.now();
    try {
      await new Promise((resolve, reject) => {
        const ffmpeg = execFile('ffmpeg', [
          '-i', filePath,
          '-ss', String(start),
          '-t', String(chunkLength),
          '-acodec', 'pcm_s16le',
          '-ar', '44100',
          '-ac', '1',
          '-fflags', '+genpts+igndts',
          '-err_detect', 'ignore_err',
          '-y',
          chunkPath,
        ], (err, stdout, stderr) => {
          if (episodeFileId) {
            delete activeFfmpegJobs[episodeFileId];
          }
          const fileExists = fs.existsSync(chunkPath);
          if (err && !fileExists) {
            const truncatedStderr = stderr ? stderr.split('\n').slice(0, 5).join('\n') : '';
            workerLogger.error({ filePath, start, error: err.message, stderr: truncatedStderr }, 'FFmpeg chunk extraction failed');
            return reject(err);
          } else if (err && fileExists) {
            const truncatedStderr = stderr ? stderr.split('\n').slice(0, 3).join('\n') : '';
            if (truncatedStderr) {
              workerLogger.debug({ filePath, start, stderr: truncatedStderr }, 'FFmpeg warnings during chunk extraction (file created successfully)');
            }
            resolve();
          } else {
            resolve();
          }
        });
        if (episodeFileId) {
          activeFfmpegJobs[episodeFileId] = {
            pid: ffmpeg.pid,
            filePath,
            startTime: Date.now(),
            progress: i,
            total: totalChunks,
            status: 'chunking',
          };
        }
      });
      if (progressCallback) {
        const percent = Math.round((i / totalChunks) * 100);
        progressCallback(percent, `Chunk ${i + 1} of ${totalChunks} extracted`);
      }
      const tChunkEnd = Date.now();
      workerLogger.info({ filePath, chunk: i, totalChunks, start, durationMs: tChunkEnd - tChunk }, `Chunk ${i + 1} of ${totalChunks} extraction complete`);

      // Fingerprint the chunk
      const tFp = Date.now();
      const fp = await new Promise((resolve, reject) => {
        execFile('fpcalc', ['-json', chunkPath], (err, stdout) => {
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
      if (progressCallback) {
        const percent = Math.round(((i + 0.5) / totalChunks) * 100);
        progressCallback(percent, `Chunk ${i + 1} of ${totalChunks} fingerprinted`);
      }
      const tFpEnd = Date.now();
      workerLogger.info({ filePath, chunk: i, start, durationMs: tFpEnd - tFp }, 'Fingerprinting complete');

      results.push({ start, fingerprint: fp });

      // Clean up chunk file
      try {
        await fsp.unlink(chunkPath);
      } catch (cleanupErr) {
        // Ignore cleanup errors
      }

    } catch (error) {
      workerLogger.warn({
        filePath,
        start,
        error: error.message,
      }, 'Failed to process chunk, skipping');
      try {
        await fsp.unlink(chunkPath);
      } catch (cleanupErr) {}
    }
  }
  const tChunkEndAll = Date.now();
  workerLogger.info({ filePath, totalChunks, totalDurationMs: tChunkEndAll - tChunkStart }, 'All chunking+fingerprinting complete');
  // Emit 100% progress at end
  if (progressCallback) {
    progressCallback(100, 'All chunks processed and fingerprinted');
  }
  if (episodeFileId && typeof broadcastJobUpdate === 'function') {
    broadcastJobUpdate({
      episodeFileId,
      filePath,
      percent: 100,
      status: 'chunking',
      type: 'ffmpeg-progress',
    });
    delete activeFfmpegJobs[episodeFileId];
  }
  return results;
}

/**
 * Store episode fingerprint data in database
 */
async function storeEpisodeFingerprints(showId, seasonNumber, episodeNumber, episodeFileId, fingerprintData, fileDuration, fileSize) {
  const db = await getDb();
  const now = new Date().toISOString();

  const sql = `
    INSERT OR REPLACE INTO episode_fingerprints 
    (show_id, season_number, episode_number, episode_file_id, fingerprint_data, file_duration, file_size, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.prepare(sql).run(
    showId,
    seasonNumber,
    episodeNumber,
    episodeFileId,
    JSON.stringify(fingerprintData),
    fileDuration,
    fileSize,
    now,
    now,
  );

  workerLogger.info({
    showId,
    seasonNumber,
    episodeNumber,
    episodeFileId,
    fingerprintCount: fingerprintData.length,
  }, 'Episode fingerprints stored in database');
}

/**
 * Get stored fingerprint data for a season
 */
async function getSeasonFingerprints(showId, seasonNumber, includeInvalid = false) {
  const db = await getDb();

  const sql = `
    SELECT 
      efp.*, 
      e.episode_number, 
      e.title as episode_title
    FROM seasons s
    JOIN episodes e ON e.season_id = s.id
    JOIN episode_files f ON f.episode_id = e.id
    JOIN episode_fingerprints efp ON efp.episode_file_id = f.id
    WHERE s.show_id = ? AND s.season_number = ?
    ${includeInvalid ? '' : 'AND efp.is_valid = 1'}
    ORDER BY e.episode_number
  `;

  const results = db.prepare(sql).all(showId, seasonNumber);

  return results.map((row) => ({
    ...row,
    fingerprint_data: JSON.parse(row.fingerprint_data),
  }));
}

/**
 * Get stored fingerprint data for previous seasons (for cross-season fallback)
 */
async function getPreviousSeasonFingerprints(showId, currentSeasonNumber, limit = 3) {
  const db = await getDb();

  const sql = `
    SELECT 
      ef.*,
      e.episode_number,
      e.title as episode_title
    FROM episode_fingerprints ef
    JOIN episodes e ON ef.episode_number = e.episode_number
    JOIN seasons s ON e.season_id = s.id
    WHERE ef.show_id = ? AND ef.season_number < ? AND ef.is_valid = 1
    ORDER BY ef.season_number DESC, ef.episode_number
    LIMIT ?
  `;

  const results = db.prepare(sql).all(showId, currentSeasonNumber, limit * 10); // Get more episodes, we'll limit by season

  // Group by season and take the most recent seasons
  const seasonGroups = {};
  results.forEach((row) => {
    if (!seasonGroups[row.season_number]) {
      seasonGroups[row.season_number] = [];
    }
    seasonGroups[row.season_number].push({
      ...row,
      fingerprint_data: JSON.parse(row.fingerprint_data),
    });
  });

  const sortedSeasons = Object.keys(seasonGroups)
    .map(Number)
    .sort((a, b) => b - a)
    .slice(0, limit);

  return sortedSeasons.flatMap((season) => seasonGroups[season]);
}

/**
 * Build fingerprint map across episodes
 */
function buildFingerprintMap(episodes) {
  const fpMap = new Map(); // fingerprint → [ { epId, time } ... ]

  for (const episode of episodes) {
    const epId = episode.episode_file_id;
    const fingerprints = episode.fingerprint_data;

    for (const chunk of fingerprints) {
      const fp = chunk.fingerprint;
      if (!fpMap.has(fp)) {
        fpMap.set(fp, []);
      }
      fpMap.get(fp).push({ epId, time: chunk.start });
    }
  }

  return fpMap;
}

/**
 * Select fingerprints that appear in ≥ threshold percent of episodes
 */
function selectCommonFingerprints(fpMap, episodesCount, thresholdPercent = 0.8) {
  const minCount = ceil(episodesCount * thresholdPercent);
  const commonFpMap = new Map();

  for (const [fp, occs] of fpMap) {
    const uniqueEpisodes = new Set(occs.map((o) => o.epId));
    if (uniqueEpisodes.size >= minCount) {
      commonFpMap.set(fp, occs);
    }
  }

  return commonFpMap;
}

/**
 * Cluster fingerprints by time proximity
 */
function clusterByTime(entries, timeThreshold = 15) {
  if (entries.length === 0) {
    return [];
  }

  // Sort entries by time for efficient clustering
  entries.sort((a, b) => a.time - b.time);

  const clusters = [];
  let currentCluster = [entries[0]];

  for (let i = 1; i < entries.length; i++) {
    const entry = entries[i];
    const lastEntry = currentCluster[currentCluster.length - 1];

    // If this entry is within the time threshold of the last entry in current cluster
    if (Math.abs(entry.time - lastEntry.time) <= timeThreshold) {
      currentCluster.push(entry);
    } else {
      // Start a new cluster
      clusters.push(currentCluster);
      currentCluster = [entry];
    }
  }

  // Don't forget the last cluster
  clusters.push(currentCluster);

  return clusters;
}

/**
 * Detect segments using clustering approach
 * Fingerprint everywhere, cluster by timestamp, label by position
 */
function detectSegments(commonFpMap, episodeDuration, options = {}) {
  const {
    timeThreshold = 15, // seconds for clustering
    marginSec = 5, // margin around detected segments
    windowSec = 10, // fingerprint window size
    minEpisodeCoverage = 0.7, // minimum % of episodes a segment must appear in
  } = options;

  if (!commonFpMap || commonFpMap.size === 0) {
    return { segments: [], intro: null, credits: null };
  }

  // 1) Flatten to array of all { fp, time, epId } entries
  const entries = [];
  for (const [fp, occs] of commonFpMap) {
    for (const occ of occs) {
      entries.push({ fp, time: occ.time, epId: occ.epId });
    }
  }

  workerLogger.info({
    totalEntries: entries.length,
    uniqueFingerprints: commonFpMap.size,
  }, 'Flattened fingerprint entries for clustering');

  // 2) Cluster by time proximity
  const clusters = clusterByTime(entries, timeThreshold);

  workerLogger.info({
    clusterCount: clusters.length,
    timeThreshold,
  }, 'Time-based clustering completed');

  // 3) For each cluster, compute segment info
  const segments = clusters.map((cluster, index) => {
    const times = cluster.map((e) => e.time);
    const episodeIds = cluster.map((e) => e.epId);
    const uniqueEpisodes = new Set(episodeIds);

    return {
      id: index,
      start: Math.max(0, Math.min(...times) - marginSec),
      end: Math.min(episodeDuration, Math.max(...times) + marginSec + windowSec),
      medianTime: times.sort((a, b) => a - b)[Math.floor(times.length / 2)],
      episodeCount: uniqueEpisodes.size,
      fingerprintCount: cluster.length,
      episodeIds: Array.from(uniqueEpisodes),
      times: times,
    };
  });

  // 4) Filter segments by episode coverage
  const totalEpisodes = new Set(entries.map((e) => e.epId)).size;
  const minEpisodes = Math.ceil(totalEpisodes * minEpisodeCoverage);

  const goodSegments = segments.filter((seg) => seg.episodeCount >= minEpisodes);

  workerLogger.info({
    totalSegments: segments.length,
    goodSegments: goodSegments.length,
    minEpisodes,
    totalEpisodes,
    coverageThreshold: `${(minEpisodeCoverage * 100).toFixed(1)}%`,
  }, 'Filtered segments by episode coverage');

  // 5) Sort by start time
  goodSegments.sort((a, b) => a.start - b.start);

  // 6) Label segments by position
  let intro = null;
  let credits = null;
  const stingers = [];

  if (goodSegments.length > 0) {
    // First segment is almost always intro
    intro = goodSegments[0];

    // Last segment is usually credits
    if (goodSegments.length > 1) {
      credits = goodSegments[goodSegments.length - 1];

      // Middle segments are stingers/bumpers
      stingers.push(...goodSegments.slice(1, -1));
    } else {
      // Only one segment - could be either intro or credits
      // Use position to determine
      if (intro.medianTime < episodeDuration * 0.1) {
        // In first 10% of episode - likely intro
        workerLogger.info('Single segment detected in early position, labeling as intro');
      } else if (intro.medianTime > episodeDuration * 0.8) {
        // In last 20% of episode - likely credits
        credits = intro;
        intro = null;
        workerLogger.info('Single segment detected in late position, labeling as credits');
      } else {
        // Middle position - unclear, treat as intro for now
        workerLogger.info('Single segment detected in middle position, treating as intro');
      }
    }
  }

  // Log detailed segment analysis
  workerLogger.info({
    intro: intro ? {
      start: intro.start,
      end: intro.end,
      episodeCount: intro.episodeCount,
      medianTime: intro.medianTime,
    } : null,
    credits: credits ? {
      start: credits.start,
      end: credits.end,
      episodeCount: credits.episodeCount,
      medianTime: credits.medianTime,
    } : null,
    stingers: stingers.map((s) => ({
      start: s.start,
      end: s.end,
      episodeCount: s.episodeCount,
      medianTime: s.medianTime,
    })),
    totalSegments: goodSegments.length,
  }, 'Segment detection and labeling completed');

  return {
    segments: goodSegments,
    intro,
    credits,
    stingers,
  };
}

/**
 * Calculate confidence score for clustering-based detection
 */
function calculateClusteringConfidence(segments, totalEpisodes, episodeDuration) {
  if (!segments || segments.length === 0) {
    return 0.00;
  }

  // Base confidence from segment coverage
  const totalSegmentEpisodes = segments.reduce((sum, seg) => sum + seg.episodeCount, 0);
  const avgEpisodeCoverage = totalSegmentEpisodes / (segments.length * totalEpisodes);
  const coverageConfidence = Math.min(avgEpisodeCoverage * 0.6, 0.6);

  // Segment count bonus (more segments = more confidence)
  const segmentBonus = Math.min(segments.length * 0.1, 0.2);

  // Episode count bonus
  const episodeBonus = Math.min(totalEpisodes / 10, 0.2);

  const totalConfidence = coverageConfidence + segmentBonus + episodeBonus;

  // Round to 2 decimal places
  return round(Math.min(totalConfidence, 1.00), 2);
}

/**
 * Smart data preservation logic
 */
function shouldPreserveExistingData(existingData, newData) {
  if (!existingData) {
    return { preserve: false, reason: 'No existing data' };
  }

  // If existing data has high confidence and new data has no detections
  if (existingData.confidence_score > 0.8 && newData.confidence_score < 0.3) {
    return {
      preserve: true,
      reason: 'High confidence existing data vs low confidence new data',
      recommendation: 'Keep existing data for future episodes',
    };
  }

  // If existing data has detections but new data has none
  if (existingData.hasDetections && !newData.hasDetections) {
    return {
      preserve: true,
      reason: 'Existing detections found, new scan found none',
      recommendation: 'Files may have been already processed',
    };
  }

  // Only overwrite if new data is clearly better
  const confidenceImprovement = newData.confidence_score - existingData.confidence_score;
  const shouldOverwrite = confidenceImprovement > 0.2;

  return {
    preserve: !shouldOverwrite,
    reason: 'Confidence-based assessment',
    recommendation: shouldOverwrite ? 'Overwrite with new data' : 'Keep existing data',
  };
}

/**
 * Store detection results in database
 */
async function storeDetectionResults(showId, seasonNumber, episodeNumber, episodeFileId, detectionData) {
  const db = await getDb();
  const now = new Date().toISOString();

  const sql = `
    INSERT OR REPLACE INTO detection_results 
    (show_id, season_number, episode_number, episode_file_id, 
     intro_start, intro_end, credits_start, credits_end, 
     stingers_data, segments_data,
     confidence_score, detection_method, approval_status, 
     processing_notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  // Serialize stingers and segments data
  const stingersData = detectionData.stingers ? JSON.stringify(detectionData.stingers) : null;
  const segmentsData = detectionData.segments ? JSON.stringify(detectionData.segments) : null;

  db.prepare(sql).run(
    showId,
    seasonNumber,
    episodeNumber,
    episodeFileId,
    detectionData.intro?.start || null,
    detectionData.intro?.end || null,
    detectionData.credits?.start || null,
    detectionData.credits?.end || null,
    stingersData,
    segmentsData,
    detectionData.confidence_score,
    detectionData.detection_method,
    detectionData.approval_status || 'pending',
    detectionData.processing_notes || '',
    now,
    now,
  );

  workerLogger.info({
    showId,
    seasonNumber,
    episodeNumber,
    episodeFileId,
    confidence: detectionData.confidence_score,
    method: detectionData.detection_method,
    intro: detectionData.intro ? `${detectionData.intro.start}s-${detectionData.intro.end}s` : 'none',
    credits: detectionData.credits ? `${detectionData.credits.start}s-${detectionData.credits.end}s` : 'none',
    stingers: detectionData.stingers ? detectionData.stingers.length : 0,
    segments: detectionData.segments ? detectionData.segments.length : 0,
  }, 'Detection results stored in database');
}

/**
 * Get auto-processing settings
 */
async function getAutoProcessingSettings() {
  const db = await getDb();
  const threshold = parseFloat(getSetting(db, 'min_confidence_threshold', '0.8'));
  const autoProcess = getSetting(db, 'auto_process_detections', '0') === '1';

  return {
    threshold: round(threshold, 2),
    autoProcess,
  };
}

/**
 * Main detection pipeline for a season
 */
export async function detectIntroAndCreditsForSeason(showId, seasonNumber, options = {}) {
  const startTime = Date.now();
  workerLogger.info({
    showId,
    seasonNumber,
    options,
  }, 'Starting season detection pipeline');

  try {
    // Initialize schema if needed
    await initializeFingerprintSchema();

    // Get current season fingerprints
    const currentSeasonEpisodes = await getSeasonFingerprints(showId, seasonNumber);
    workerLogger.info({
      showId,
      seasonNumber,
      episodeCount: currentSeasonEpisodes.length,
    }, 'Retrieved current season fingerprints');

    // Determine detection method and episodes to use
    let detectionEpisodes = currentSeasonEpisodes;
    let detectionMethod = 'current_season';
    let crossSeasonData = null;

    // If insufficient episodes in current season, try cross-season fallback
    if (currentSeasonEpisodes.length < 3) {
      workerLogger.info({
        showId,
        seasonNumber,
        currentEpisodeCount: currentSeasonEpisodes.length,
      }, 'Insufficient episodes in current season, attempting cross-season fallback');

      const previousSeasonEpisodes = await getPreviousSeasonFingerprints(showId, seasonNumber);

      if (previousSeasonEpisodes.length > 0) {
        // Combine current and previous season data
        detectionEpisodes = [...currentSeasonEpisodes, ...previousSeasonEpisodes];
        detectionMethod = 'cross_season';
        crossSeasonData = {
          currentSeasonCount: currentSeasonEpisodes.length,
          previousSeasonCount: previousSeasonEpisodes.length,
          totalEpisodes: detectionEpisodes.length,
        };

        workerLogger.info({
          showId,
          seasonNumber,
          crossSeasonData,
        }, 'Using cross-season detection method');
      }
    }

    if (detectionEpisodes.length === 0) {
      workerLogger.warn({
        showId,
        seasonNumber,
      }, 'No episodes available for detection');

      return {
        success: false,
        reason: 'No episodes available',
        confidence_score: 0.00,
        detection_method: 'none',
      };
    }

    // Build fingerprint map
    const fpMap = buildFingerprintMap(detectionEpisodes);
    workerLogger.info({
      showId,
      seasonNumber,
      uniqueFingerprints: fpMap.size,
    }, 'Built fingerprint map');

    // Select common fingerprints
    const thresholdPercent = options.thresholdPercent || 0.5;
    const commonFpMap = selectCommonFingerprints(fpMap, detectionEpisodes.length, thresholdPercent);

    // Log detailed confidence calculation breakdown
    const minRequiredEpisodes = Math.ceil(detectionEpisodes.length * thresholdPercent);
    workerLogger.info({
      showId,
      seasonNumber,
      totalEpisodes: detectionEpisodes.length,
      uniqueFingerprints: fpMap.size,
      commonFingerprints: commonFpMap.size,
      thresholdPercent: `${(thresholdPercent * 100).toFixed(1)}%`,
      minRequiredEpisodes,
      thresholdCalculation: `${detectionEpisodes.length} episodes × ${(thresholdPercent * 100).toFixed(1)}% = ${minRequiredEpisodes} episodes required`,
      noCommonFingerprints: commonFpMap.size === 0 ? 'No fingerprints found in enough episodes to meet threshold' : null,
    }, 'Fingerprint selection analysis');

    // Get episode duration for detection
    const episodeDuration = detectionEpisodes[0]?.file_duration || 0;

    // Detect ranges
    const ranges = detectSegments(commonFpMap, episodeDuration, options);

    // Calculate confidence with detailed breakdown
    const confidence = calculateClusteringConfidence(ranges.segments, detectionEpisodes.length, episodeDuration);

    // Log confidence calculation details
    workerLogger.info({
      showId,
      seasonNumber,
      finalConfidence: `${(confidence * 100).toFixed(2)}%`,
      commonFingerprints: commonFpMap.size,
      totalEpisodes: detectionEpisodes.length,
      episodeDuration: `${episodeDuration.toFixed(1)}s`,
      introDetected: !!ranges.intro,
      creditsDetected: !!ranges.credits,
    }, 'Confidence calculation completed');

    // Check for existing detection results
    const existingResults = await getExistingDetectionResults(showId, seasonNumber);

    // Apply smart data preservation
    const hasDetections = (ranges.intro || ranges.credits);
    const preservationDecision = shouldPreserveExistingData(existingResults, {
      confidence_score: confidence,
      hasDetections,
    });

    if (preservationDecision.preserve && existingResults) {
      workerLogger.info({
        showId,
        seasonNumber,
        reason: preservationDecision.reason,
        recommendation: preservationDecision.recommendation,
      }, 'Preserving existing detection data');

      return {
        success: true,
        preserved: true,
        reason: preservationDecision.reason,
        confidence_score: existingResults.confidence_score,
        detection_method: existingResults.detection_method,
        intro: existingResults.intro,
        credits: existingResults.credits,
      };
    }

    // Get auto-processing settings
    const autoSettings = await getAutoProcessingSettings();
    const approvalStatus = (confidence >= autoSettings.threshold && autoSettings.autoProcess) ?
      'auto_approved' : 'pending';

    // Store detection results for each episode in the season
    for (const episode of currentSeasonEpisodes) {
      const detectionData = {
        intro: ranges.intro,
        credits: ranges.credits,
        stingers: ranges.stingers,
        segments: ranges.segments,
        confidence_score: confidence,
        detection_method: detectionMethod,
        approval_status: approvalStatus,
        processing_notes: `Season batch detection. ${crossSeasonData ?
          `Cross-season: ${crossSeasonData.currentSeasonCount} current + ${crossSeasonData.previousSeasonCount} previous episodes` :
          `${detectionEpisodes.length} episodes analyzed`}`,
      };

      await storeDetectionResults(
        showId,
        seasonNumber,
        episode.episode_number,
        episode.episode_file_id,
        detectionData,
      );
    }

    const duration = Date.now() - startTime;
    workerLogger.info({
      showId,
      seasonNumber,
      duration,
      confidence,
      method: detectionMethod,
      approvalStatus,
      intro: ranges.intro ? `${ranges.intro.start}s-${ranges.intro.end}s` : 'none',
      credits: ranges.credits ? `${ranges.credits.start}s-${ranges.credits.end}s` : 'none',
      stingers: ranges.stingers ? ranges.stingers.length : 0,
      segments: ranges.segments ? ranges.segments.length : 0,
    }, 'Season detection pipeline completed successfully');

    return {
      success: true,
      confidence_score: confidence,
      detection_method: detectionMethod,
      approval_status: approvalStatus,
      intro: ranges.intro,
      credits: ranges.credits,
      stingers: ranges.stingers,
      segments: ranges.segments,
      cross_season_data: crossSeasonData,
      processing_time_ms: duration,
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    workerLogger.error({
      showId,
      seasonNumber,
      error: error.message,
      duration,
    }, 'Season detection pipeline failed');

    throw error;
  }
}

/**
 * Process a single episode and trigger season batch detection
 */
export async function processEpisodeAndTriggerSeasonDetection(episodeFileId, options = {}, progressCallback = null) {
  const startTime = Date.now();

  try {
    const db = await getDb();

    // Get episode file details
    const episodeFile = await getEpisodeFileDetails(db, episodeFileId);
    if (!episodeFile) {
      workerLogger.error({ episodeFileId }, 'Episode file not found, skipping job');
      throw new Error(`Episode file not found: ${episodeFileId}`);
    }

    // Defensive: log and check for required fields
    const { show_id, season_number, episode_number, file_path: filePath } = episodeFile;
    if (!show_id || !season_number || !episode_number || !filePath) {
      workerLogger.error({
        episodeFileId,
        episodeFile,
      }, 'Missing required episode file fields (show_id, season_number, episode_number, file_path). Skipping job.');
      throw new Error(`Missing required episode file fields for episodeFileId: ${episodeFileId}`);
    }

    // Analyze file state
    if (progressCallback) {
      progressCallback(2, 'Analyzing file state...');
    }
    const fileState = await analyzeFileState(filePath);

    // Always use temp dir from settings
    const tempBase = getSetting(db, 'temp_dir', null) || require('os').tmpdir() + '/cliprr';
    const tempDir = path.join(tempBase, uuidv4());
    workerLogger.info({ episodeFileId, tempDir }, 'Using temp directory for processing');
    await fsp.mkdir(tempDir, { recursive: true });

    try {
      // Extract audio
      if (progressCallback) {
        progressCallback(5, 'Starting audio extraction...');
      }
      workerLogger.info({ episodeFileId, filePath }, 'Starting audio extraction...');
      const audioPath = await extractAudioFromFile(filePath, tempDir, episodeFileId);
      if (progressCallback) {
        progressCallback(15, 'Audio extraction completed');
      }
      workerLogger.info({ episodeFileId, audioPath }, 'Audio extraction completed');

      // Generate fingerprints
      const chunkLength = options.chunkLength || 30;
      const overlap = options.overlap || 20;
      if (progressCallback) {
        progressCallback(20, 'Starting fingerprint generation...');
      }
      workerLogger.info({ episodeFileId, chunkLength, overlap }, 'Starting fingerprint generation...');
      const fingerprints = await fingerprintEpisodeChunks(audioPath, chunkLength, overlap, episodeFileId, progressCallback);
      if (progressCallback) {
        progressCallback(70, 'Fingerprint generation completed');
      }
      workerLogger.info({
        episodeFileId,
        fingerprintCount: fingerprints.length,
        chunkLength,
        overlap,
      }, 'Fingerprint generation completed');

      // Store fingerprints
      if (progressCallback) {
        progressCallback(75, 'Storing fingerprints...');
      }
      await storeEpisodeFingerprints(
        show_id,
        season_number,
        episode_number,
        episodeFileId,
        fingerprints,
        fileState.duration,
        fileState.fileSize,
      );
      if (progressCallback) {
        progressCallback(80, 'Fingerprints stored');
      }

      // Trigger season batch detection
      if (progressCallback) {
        progressCallback(85, 'Starting season detection...');
      }
      workerLogger.info({ episodeFileId, show_id, season_number }, 'Starting season detection...');
      const seasonDetectionResult = await detectIntroAndCreditsForSeason(show_id, season_number, options);
      if (progressCallback) {
        progressCallback(95, 'Season detection completed');
      }

      const duration = Date.now() - startTime;
      workerLogger.info({
        episodeFileId,
        show_id,
        season_number,
        episode_number,
        duration,
        seasonDetectionSuccess: seasonDetectionResult.success,
      }, 'Episode processing and season detection completed');

      return {
        success: true,
        episodeFileId,
        show_id,
        season_number,
        episode_number,
        fingerprintCount: fingerprints.length,
        seasonDetection: seasonDetectionResult,
        processing_time_ms: duration,
      };

    } finally {
      // Clean up temp directory
      try {
        const files = await fsp.readdir(tempDir);
        await Promise.all(files.map((f) => fsp.unlink(path.join(tempDir, f))));
        await fsp.rmdir(tempDir);
      } catch (cleanupErr) {
        workerLogger.warn({
          tempDir,
          error: cleanupErr.message,
        }, 'Failed to clean up temp directory');
      }
    }

  } catch (error) {
    const duration = Date.now() - startTime;
    workerLogger.error({
      episodeFileId,
      error: error.message,
      duration,
    }, 'Episode processing and season detection failed');

    throw error;
  }
}

/**
 * Get episode file details with show/season/episode information
 */
async function getEpisodeFileDetails(db, episodeFileId) {
  const sql = `
    SELECT 
      ef.id as episode_file_id,
      ef.file_path,
      ef.size,
      e.episode_number,
      e.title as episode_title,
      s.season_number,
      sh.id as show_id,
      sh.title as show_title
    FROM episode_files ef
    JOIN episodes e ON ef.episode_id = e.id
    JOIN seasons s ON e.season_id = s.id
    JOIN shows sh ON s.show_id = sh.id
    WHERE ef.id = ?
  `;

  return db.prepare(sql).get(episodeFileId);
}

/**
 * Get existing detection results for a season
 */
async function getExistingDetectionResults(showId, seasonNumber) {
  const db = await getDb();

  const sql = `
    SELECT 
      intro_start, intro_end, credits_start, credits_end,
      confidence_score, detection_method, approval_status
    FROM detection_results
    WHERE show_id = ? AND season_number = ?
    ORDER BY confidence_score DESC
    LIMIT 1
  `;

  return db.prepare(sql).get(showId, seasonNumber);
}

/**
 * Invalidate fingerprint data for a show/season (for rescan scenarios)
 */
export async function invalidateFingerprintData(showId, seasonNumber = null) {
  const db = await getDb();
  const now = new Date().toISOString();

  let sql, params;
  if (seasonNumber !== null) {
    sql = `
      UPDATE episode_fingerprints 
      SET is_valid = 0, updated_at = ?
      WHERE show_id = ? AND season_number = ?
    `;
    params = [now, showId, seasonNumber];
  } else {
    sql = `
      UPDATE episode_fingerprints 
      SET is_valid = 0, updated_at = ?
      WHERE show_id = ?
    `;
    params = [now, showId];
  }

  const result = db.prepare(sql).run(...params);

  workerLogger.info({
    showId,
    seasonNumber,
    affectedRows: result.changes,
  }, 'Fingerprint data invalidated for rescan');

  return result.changes;
}

/**
 * Get detection statistics for a show
 */
export async function getDetectionStats(showId) {
  const db = await getDb();

  const sql = `
    SELECT 
      season_number,
      COUNT(*) as episode_count,
      AVG(confidence_score) as avg_confidence,
      COUNT(CASE WHEN approval_status = 'auto_approved' THEN 1 END) as auto_approved_count,
      COUNT(CASE WHEN approval_status = 'manual_approved' THEN 1 END) as manual_approved_count,
      COUNT(CASE WHEN approval_status = 'pending' THEN 1 END) as pending_count
    FROM detection_results
    WHERE show_id = ?
    GROUP BY season_number
    ORDER BY season_number
  `;

  return db.prepare(sql).all(showId);
}
