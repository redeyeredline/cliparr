import { getDatabaseSingleton } from './Auto_DB_Setup.js';
import { logger } from '../services/logger.js';

function getDb(dbPath = 'data/cliparr.db') {
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
      epMap.set(ep.episodeNumber, insertEpisode(db, sid, ep));
    });
    files.forEach((f) => {
      const eid = epMap.get(f.episodeNumber);
      if (eid) {
        insertEpisodeFile(db, eid, f);
      }
    });
  })();
}

function batchInsertShows(db, shows) {
  return db.transaction(() => {
    shows.forEach((s) => {
      try {
        timedQuery(db, 'INSERT OR IGNORE INTO shows (title, path) VALUES (?, ?)', [s.title || '', s.path || ''], 'run');
      } catch {
        logger.warn({ showTitle: s.title }, 'Batch insert error');
      }
    });
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
    result = db.prepare(sql)[fn](...params);
  } finally {
    const duration = Number(process.hrtime.bigint() - start) / 1e6;
    logQueryPerformance(sql, duration);
  }
  return result;
}

function getShowById(db, id) {
  return timedQuery(db, 'SELECT * FROM shows WHERE id = ?', [id], 'get');
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

function findShowByTitleAndPath(db, title, path) {
  const sql = 'SELECT id FROM shows WHERE title = ? AND path = ?';
  return timedQuery(db, sql, [title, path], 'get');
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
  logger,
  getPerformanceStats,
  timedQuery,
  getShowById,
  deleteShowsByIds,
  findShowByTitleAndPath,
};
