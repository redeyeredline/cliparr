import { workerLogger } from './logger.js';
import { getDb } from '../database/Db_Operations.js';

// Remove fingerprint data from database for a specific episode file
export async function removeFingerprintData(episodeFileId) {
  try {
    const db = await getDb();

    // Remove from episode_fingerprints table
    const fingerprintResult = db.prepare(`
      DELETE FROM episode_fingerprints 
      WHERE episode_file_id = ?
    `).run(episodeFileId);

    // Remove from detection_results table
    const detectionResult = db.prepare(`
      DELETE FROM detection_results 
      WHERE episode_file_id = ?
    `).run(episodeFileId);

    if (fingerprintResult.changes > 0 || detectionResult.changes > 0) {
      workerLogger.info({
        episodeFileId,
        fingerprintsRemoved: fingerprintResult.changes,
        detectionsRemoved: detectionResult.changes,
      }, 'Removed fingerprint data from database');
    }
  } catch (error) {
    workerLogger.warn({ episodeFileId, error: error.message }, 'Failed to remove fingerprint data');
  }
}

// Remove detection results from database for a specific episode file (keep fingerprints)
export async function removeDetectionData(episodeFileId) {
  try {
    const db = await getDb();

    // Only remove from detection_results table, keep fingerprints
    const detectionResult = db.prepare(`
      DELETE FROM detection_results 
      WHERE episode_file_id = ?
    `).run(episodeFileId);

    if (detectionResult.changes > 0) {
      workerLogger.info({
        episodeFileId,
        detectionsRemoved: detectionResult.changes,
      }, 'Removed detection results from database (fingerprints preserved)');
    }
  } catch (error) {
    workerLogger.warn({ episodeFileId, error: error.message }, 'Failed to remove detection data');
  }
}
