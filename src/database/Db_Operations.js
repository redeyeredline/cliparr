import { getDatabaseSingleton } from './Auto_DB_Setup.js';
import { logger } from '../services/logger.js';

function getDb(dbPath = 'data/cliparr.db') {
  return getDatabaseSingleton(dbPath);
}

function upsertReturningId(db, insertSql, insertParams, selectSql, selectParams) {
  const r = db.prepare(insertSql).run(...insertParams);
  return r.lastInsertRowid || db.prepare(selectSql).get(...selectParams).id;
}

function insertShow(db, show) {
  logger.info({ showTitle: show.title }, 'Insert show');
  return upsertReturningId(
    db,
    'INSERT OR REPLACE INTO shows (title, path) VALUES (?, ?)',
    [show.title || '', show.path || ''],
    'SELECT id FROM shows WHERE title = ? AND path = ?',
    [show.title || '', show.path || ''],
  );
}

function insertSeason(db, showId, seasonNumber) {
  logger.debug({ showId, seasonNumber }, 'Insert season');
  return upsertReturningId(
    db,
    'INSERT OR IGNORE INTO seasons (show_id, season_number) VALUES (?, ?)',
    [showId, seasonNumber],
    'SELECT id FROM seasons WHERE show_id = ? AND season_number = ?',
    [showId, seasonNumber],
  );
}

function insertEpisode(db, seasonId, ep) {
  logger.debug({ episodeNumber: ep.episodeNumber }, 'Insert episode');
  return upsertReturningId(
    db,
    'INSERT OR REPLACE INTO episodes (season_id, episode_number, title) VALUES (?, ?, ?)',
    [seasonId, ep.episodeNumber || null, ep.title || ''],
    'SELECT id FROM episodes WHERE season_id = ? AND episode_number = ?',
    [seasonId, ep.episodeNumber || null],
  );
}

function insertEpisodeFile(db, episodeId, file) {
  logger.debug({ episodeId, path: file.path }, 'Insert file');
  return db.prepare(
    'INSERT INTO episode_files (episode_id, file_path, size) VALUES (?, ?, ?)',
  ).run(
    episodeId,
    file.path || '',
    file.size || 0,
  ).lastInsertRowid;
}

function processShowData(db, show, episodes = [], files = []) {
  logger.info({ showTitle: show.title, count: episodes.length }, 'Process show');
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
  logger.info({ showCount: shows.length }, 'Batch insert shows');
  return db.transaction(() => {
    const stmt = db.prepare(
      'INSERT OR IGNORE INTO shows (title, path) VALUES (?, ?)',
    );
    shows.forEach((s) => {
      try {
        stmt.run(s.title || '', s.path || '');
      } catch {
        logger.warn({ showTitle: s.title }, 'Batch insert error');
      }
    });
  })();
}

function getImportedShows(db, page = 1, pageSize = 100) {
  const p = Math.max(1, +page), sz = Math.max(1, +pageSize), offset = (p - 1) * sz;
  logger.info({ page: p, pageSize: sz }, 'Fetch shows');
  const shows = db.prepare(
    `SELECT s.id, s.title, s.path
       FROM shows s
      ORDER BY s.title
      LIMIT ? OFFSET ?`,
  ).all(sz, offset);
  const total = db.prepare('SELECT COUNT(*) AS count FROM shows').get().count;
  return { shows, total, page: p, pageSize: sz, totalPages: Math.ceil(total / sz) };
}

function getSetting(db, key, defaultValue = null) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : defaultValue;
}

function setSetting(db, key, value) {
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
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
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('import_mode');
    return row ? row.value : 'none';
  } catch (error) {
    logger.error('Failed to get import mode:', error);
    throw error;
  }
}

function setImportMode(db, mode) {
  try {
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
      .run('import_mode', mode);
  } catch (error) {
    logger.error('Failed to set import mode:', error);
    throw error;
  }
}

function getPollingInterval(db) {
  try {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('polling_interval');
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
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
      .run('polling_interval', validInterval.toString());
    logger.info({ interval: validInterval }, 'Polling interval updated');
  } catch (error) {
    logger.error('Failed to set polling interval:', error);
    throw error;
  }
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
};
