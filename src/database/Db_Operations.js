// Database operations module providing CRUD functions for shows, episodes, and settings.
// Includes performance monitoring, query caching, and transaction management for SQLite operations.
import { getDatabaseSingleton } from './Auto_DB_Setup.js';
import { logger } from '../services/logger.js';
import { promises as fsPromises } from 'fs';

// Simple prepared-statement cache to avoid recompiling SQL on every call
const stmtCache = new Map();

function getCachedStmt(db, sql) {
  let stmt = stmtCache.get(sql);
  if (!stmt) {
    stmt = db.prepare(sql);
    stmtCache.set(sql, stmt);
  }
  return stmt;
}

async function getDb(dbPath = 'src/database/data/cliparr.db') {
  return getDatabaseSingleton(dbPath);
}

function upsertReturningId(db, insertSql, insertParams, selectSql, selectParams) {
  timedQuery(db, insertSql, insertParams, 'run');
  const row = timedQuery(db, selectSql, selectParams, 'get');
  return row.lastInsertRowid || row.id;
}

function insertShow(db, show) {
  return upsertReturningId(
    db,
    'INSERT OR REPLACE INTO shows (title, path) VALUES (?, ?)',
    [show.title || '', show.path || ''],
    'SELECT id FROM shows WHERE title = ? AND path = ?',
    [show.title || '', show.path || ''],
  );
}

function insertSeason(db, showId, seasonNumber) {
  return upsertReturningId(
    db,
    'INSERT OR IGNORE INTO seasons (show_id, season_number) VALUES (?, ?)',
    [showId, seasonNumber],
    'SELECT id FROM seasons WHERE show_id = ? AND season_number = ?',
    [showId, seasonNumber],
  );
}

function insertEpisode(db, seasonId, ep) {
  return upsertReturningId(
    db,
    'INSERT OR REPLACE INTO episodes (season_id, episode_number, title) VALUES (?, ?, ?)',
    [seasonId, ep.episodeNumber || null, ep.title || ''],
    'SELECT id FROM episodes WHERE season_id = ? AND episode_number = ?',
    [seasonId, ep.episodeNumber || null],
  );
}

function insertEpisodeFile(db, episodeId, file) {
  return timedQuery(
    db,
    'INSERT INTO episode_files (episode_id, file_path, size) VALUES (?, ?, ?)',
    [episodeId, file.path || '', file.size || 0],
    'run',
  ).lastInsertRowid;
}

function processShowData(db, show, episodes = [], files = []) {
  return db.transaction(() => {
    const showDbId = insertShow(db, show);
    const seasonMap = new Map(), epMap = new Map();
    episodes.forEach((ep) => {
      const sid = seasonMap.get(ep.seasonNumber)
        || insertSeason(db, showDbId, ep.seasonNumber);
      seasonMap.set(ep.seasonNumber, sid);
      epMap.set(ep.id, insertEpisode(db, sid, ep));
    });
    files.forEach((f) => {
      const eid = epMap.get(f.episodeId);
      if (eid) {
        insertEpisodeFile(db, eid, f);
      }
    });
  })();
}

function batchInsertShows(db, shows) {
  if (!shows || shows.length === 0) {
    return;
  }

  return db.transaction(() => {
    // Build multi-row INSERT statement
    const placeholders = shows.map(() => '(?, ?)').join(', ');
    const sql = `INSERT OR IGNORE INTO shows (title, path) VALUES ${placeholders}`;

    // Flatten the parameters array
    const params = shows.flatMap((s) => [s.title || '', s.path || '']);

    try {
      timedQuery(db, sql, params, 'run');
    } catch (error) {
      logger.error({ error: error.message, showCount: shows.length }, 'Batch insert failed');
      throw error;
    }
  })();
}

function getImportedShows(db, page = 1, pageSize = 100) {
  const p = Math.max(1, +page), sz = Math.max(1, +pageSize), offset = (p - 1) * sz;
  const shows = timedQuery(
    db,
    `SELECT s.id, s.title, s.path
       FROM shows s
      LIMIT ? OFFSET ?`,
    [sz, offset],
    'all',
  );
  const total = timedQuery(db, 'SELECT COUNT(*) AS count FROM shows', [], 'get').count;
  return { shows, total, page: p, pageSize: sz, totalPages: Math.ceil(total / sz) };
}

function getSetting(db, key, defaultValue = null) {
  const row = timedQuery(db, 'SELECT value FROM settings WHERE key = ?', [key], 'get');
  return row ? row.value : defaultValue;
}

function setSetting(db, key, value) {
  timedQuery(db, 'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value], 'run');
}

function withPerformanceLogging(name, fn) {
  const start = process.hrtime.bigint();
  try {
    logger.info({ operation: name }, 'Start');
    const result = fn();
    logger.info({
      operation: name,
      duration: `${Number(process.hrtime.bigint() - start) / 1e6}ms`,
      success: true,
    }, 'Done');
    return result;
  } catch (err) {
    logger.error({
      operation: name,
      duration: `${Number(process.hrtime.bigint() - start) / 1e6}ms`,
      error: err.message,
    }, 'Fail');
    throw err;
  }
}

function getImportMode(db) {
  try {
    const row = timedQuery(db, 'SELECT value FROM settings WHERE key = ?', ['import_mode'], 'get');
    return row ? row.value : 'none';
  } catch (error) {
    logger.error('Failed to get import mode:', error);
    throw error;
  }
}

function setImportMode(db, mode) {
  try {
    timedQuery(db, 'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['import_mode', mode], 'run');
  } catch (error) {
    logger.error('Failed to set import mode:', error);
    throw error;
  }
}

function getPollingInterval(db) {
  try {
    const row = timedQuery(db, 'SELECT value FROM settings WHERE key = ?', ['polling_interval'], 'get');
    return row ? parseInt(row.value, 10) : 900; // Default to 15 minutes (900 seconds)
  } catch (error) {
    logger.error('Failed to get polling interval:', error);
    throw error;
  }
}

function setPollingInterval(db, interval) {
  try {
    // Ensure interval is between 60 seconds (1 minute) and 86400 seconds (24 hours)
    const validInterval = Math.max(60, Math.min(86400, interval));
    timedQuery(db, 'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['polling_interval', validInterval.toString()], 'run');
  } catch (error) {
    logger.error('Failed to set polling interval:', error);
    throw error;
  }
}

// In-memory query performance log
const recentQueries = [];
const MAX_RECENT = 100;

function logQueryPerformance(sql, duration) {
  recentQueries.push({ sql, duration, timestamp: Date.now() });
  if (recentQueries.length > MAX_RECENT) {
    recentQueries.shift();
  }
}

function getPerformanceStats() {
  if (recentQueries.length === 0) {
    return { avgQueryTime: 0, slowestQueries: [], queryCount: 0 };
  }
  const avgQueryTime = recentQueries.reduce((a, q) => a + q.duration, 0) / recentQueries.length;
  const slowestQueries = [...recentQueries].sort((a, b) => b.duration - a.duration).slice(0, 5);
  return {
    avgQueryTime: Math.round(avgQueryTime),
    slowestQueries: slowestQueries.map((q) => ({ sql: q.sql, duration: Math.round(q.duration) })),
    queryCount: recentQueries.length,
  };
}

// Wrap a DB call to log performance
function timedQuery(db, sql, params = [], fn = 'all') {
  const start = process.hrtime.bigint();
  let result;
  try {
    // Use cached prepared statement instead of preparing each time
    const stmt = getCachedStmt(db, sql);
    result = stmt[fn](...params);
  } finally {
    const duration = Number(process.hrtime.bigint() - start) / 1e6;
    logQueryPerformance(sql, duration);
  }
  return result;
}

function getShowById(db, id) {
  return timedQuery(db, 'SELECT * FROM shows WHERE id = ?', [id], 'get');
}

// Enhanced function to get show with complete season/episode/file details
function getShowWithDetails(db, id) {
  // Get basic show info first
  const show = getShowById(db, id);
  if (!show) {
    return null;
  }

  // Get all seasons for this show with episode counts
  const seasons = timedQuery(
    db,
    `SELECT 
       s.id, 
       s.season_number,
       COUNT(e.id) as episode_count
     FROM seasons s
     JOIN episodes e ON s.id = e.season_id
     JOIN episode_files ef ON e.id = ef.episode_id
     WHERE s.show_id = ?
     GROUP BY s.id, s.season_number
     ORDER BY s.season_number`,
    [id],
    'all',
  );

  // For each season, get episodes with file counts
  const seasonsWithEpisodes = seasons.map((season) => {
    const episodes = timedQuery(
      db,
      `SELECT 
         e.id,
         e.episode_number,
         e.title,
         COUNT(ef.id) as file_count
       FROM episodes e
       JOIN episode_files ef ON e.id = ef.episode_id
       WHERE e.season_id = ?
       GROUP BY e.id, e.episode_number, e.title
       ORDER BY e.episode_number`,
      [season.id],
      'all',
    );

    return {
      ...season,
      episodes,
    };
  });

  return {
    ...show,
    seasons: seasonsWithEpisodes,
  };
}

// Get episode files for a specific episode
function getEpisodeFiles(db, episodeId) {
  return timedQuery(
    db,
    `SELECT 
       ef.id,
       ef.file_path,
       ef.size,
       e.title as episode_title,
       e.episode_number
     FROM episode_files ef
     JOIN episodes e ON ef.episode_id = e.id
     WHERE ef.episode_id = ?
     ORDER BY ef.file_path`,
    [episodeId],
    'all',
  );
}

function deleteShowsByIds(db, ids) {
  if (!Array.isArray(ids) || ids.length === 0) {
    return 0;
  }
  return db.transaction(() => {
    const placeholders = ids.map(() => '?').join(',');

    // This is simplified. For full cascade, you'd delete from related tables first.
    // The schema is set to ON DELETE CASCADE, so this should be enough.
    const stmt = `DELETE FROM shows WHERE id IN (${placeholders})`;
    const result = timedQuery(db, stmt, ids, 'run');
    return result.changes;
  })();
}

function createProcessingJobsForShows(db, showIds) {
  if (!Array.isArray(showIds) || showIds.length === 0) {
    return 0;
  }

  return db.transaction(() => {
    const placeholders = showIds.map(() => '?').join(',');

    // Get all episode files for the specified shows
    const episodeFiles = timedQuery(
      db,
      `SELECT 
         ef.id as file_id,
         ef.file_path,
         ef.size,
         e.id as episode_id,
         e.title as episode_title,
         e.episode_number,
         s.season_number,
         sh.title as show_title
       FROM episode_files ef
       JOIN episodes e ON ef.episode_id = e.id
       JOIN seasons s ON e.season_id = s.id
       JOIN shows sh ON s.show_id = sh.id
       WHERE sh.id IN (${placeholders})
       ORDER BY sh.title, s.season_number, e.episode_number`,
      showIds,
      'all',
    );

    let createdCount = 0;

    // Create processing jobs for each file
    for (const file of episodeFiles) {
      // Check if a processing job already exists for this file
      const existingJob = timedQuery(
        db,
        'SELECT id FROM processing_jobs WHERE media_file_id = ?',
        [file.file_id],
        'get',
      );

      if (!existingJob) {
        // Create a new processing job
        timedQuery(
          db,
          `INSERT INTO processing_jobs (
            media_file_id, 
            status, 
            confidence_score, 
            created_date
          ) VALUES (?, ?, ?, ?)`,
          [
            file.file_id,
            'scanning',
            0.0,
            new Date().toISOString(),
          ],
          'run',
        );
        createdCount++;
      }
    }

    return createdCount;
  })();
}

function getProcessingJobs(db, options = {}) {
  const { sortBy = '-created_date', limit = 100, status } = options;

  let sql = `
    SELECT 
      pj.*,
      ef.file_path,
      ef.size,
      e.title as episode_title,
      e.episode_number,
      s.season_number,
      sh.title as show_title
    FROM processing_jobs pj
    JOIN episode_files ef ON pj.media_file_id = ef.id
    JOIN episodes e ON ef.episode_id = e.id
    JOIN seasons s ON e.season_id = s.id
    JOIN shows sh ON s.show_id = sh.id
  `;

  const params = [];

  if (status) {
    sql += ' WHERE pj.status = ?';
    params.push(status);
  }

  // Handle sorting
  const sortField = sortBy.startsWith('-') ? sortBy.substring(1) : sortBy;
  const sortDirection = sortBy.startsWith('-') ? 'DESC' : 'ASC';
  sql += ` ORDER BY pj.${sortField} ${sortDirection}`;

  sql += ' LIMIT ?';
  params.push(limit);

  return timedQuery(db, sql, params, 'all');
}

function getProcessingJobById(db, jobId) {
  const sql = `
    SELECT 
      pj.*,
      ef.file_path,
      ef.size,
      e.title as episode_title,
      e.episode_number,
      s.season_number,
      sh.title as show_title
    FROM processing_jobs pj
    JOIN episode_files ef ON pj.media_file_id = ef.id
    JOIN episodes e ON ef.episode_id = e.id
    JOIN seasons s ON e.season_id = s.id
    JOIN shows sh ON s.show_id = sh.id
    WHERE pj.id = ?
  `;

  return timedQuery(db, sql, [jobId], 'get');
}

function updateProcessingJob(db, jobId, updateData) {
  const allowedFields = [
    'status', 'confidence_score', 'intro_start', 'intro_end',
    'credits_start', 'credits_end', 'manual_verified', 'processing_notes',
  ];

  const updates = [];
  const params = [];

  for (const [key, value] of Object.entries(updateData)) {
    if (allowedFields.includes(key)) {
      updates.push(`${key} = ?`);
      params.push(value);
    }
  }

  if (updates.length === 0) {
    throw new Error('No valid fields to update');
  }

  updates.push('updated_date = ?');
  params.push(new Date().toISOString());
  params.push(jobId);

  const sql = `UPDATE processing_jobs SET ${updates.join(', ')} WHERE id = ?`;
  timedQuery(db, sql, params, 'run');

  return getProcessingJobById(db, jobId);
}

function getProcessingJobStats(db) {
  const stats = timedQuery(
    db,
    `SELECT 
       status,
       COUNT(*) as count
     FROM processing_jobs
     GROUP BY status`,
    [],
    'all',
  );

  const total = timedQuery(
    db,
    'SELECT COUNT(*) as count FROM processing_jobs',
    [],
    'get',
  ).count;

  return {
    total,
    byStatus: stats.reduce((acc, row) => {
      acc[row.status] = row.count;
      return acc;
    }, {}),
  };
}

function findShowByTitleAndPath(db, title, path) {
  const sql = 'SELECT id FROM shows WHERE title = ? AND path = ?';
  return timedQuery(db, sql, [title, path], 'get');
}

function deleteProcessingJob(db, jobId) {
  if (!jobId) {
    return 0;
  }
  const sql = 'DELETE FROM processing_jobs WHERE id = ?';
  const result = timedQuery(db, sql, [jobId], 'run');
  return result.changes;
}

// Get a single episode file by its ID (with joined info)
function getEpisodeFileById(db, fileId) {
  return timedQuery(
    db,
    `SELECT 
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
     WHERE ef.id = ?`,
    [fileId],
    'get',
  );
}

// Get episode file IDs for specific shows
function getEpisodeFileIdsForShows(db, showIds) {
  if (!Array.isArray(showIds) || showIds.length === 0) {
    return [];
  }

  const placeholders = showIds.map(() => '?').join(',');
  return timedQuery(
    db,
    `SELECT ef.id
     FROM episode_files ef
     JOIN episodes e ON ef.episode_id = e.id
     JOIN seasons s ON e.season_id = s.id
     JOIN shows sh ON s.show_id = sh.id
     WHERE sh.id IN (${placeholders})
     ORDER BY sh.title, s.season_number, e.episode_number`,
    showIds,
    'all',
  ).map(row => row.id);
}

export {
  getDb,
  insertShow,
  insertSeason,
  insertEpisode,
  insertEpisodeFile,
  processShowData,
  batchInsertShows,
  getImportedShows,
  getSetting,
  setSetting,
  withPerformanceLogging,
  getImportMode,
  setImportMode,
  getPollingInterval,
  setPollingInterval,
  getPerformanceStats,
  timedQuery,
  getShowById,
  deleteShowsByIds,
  createProcessingJobsForShows,
  getProcessingJobs,
  getProcessingJobById,
  updateProcessingJob,
  getProcessingJobStats,
  findShowByTitleAndPath,
  getShowWithDetails,
  getEpisodeFiles,
  getEpisodeFileById,
  getEpisodeFileIdsForShows,
  deleteProcessingJob,
};
