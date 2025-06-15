import { getDatabaseSingleton } from './Auto_DB_Setup.js';
import pino from 'pino';

const logger = pino({
  level: 'info',
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: { level: label => ({ level: label }) }
});

function getDb(dbPath = 'data/cliparr.db') {
  return getDatabaseSingleton(dbPath);
}

function upsertReturningId(db, insertSql, insertParams, selectSql, selectParams) {
  const r = db.prepare(insertSql).run(...insertParams);
  return r.lastInsertRowid || db.prepare(selectSql).get(...selectParams).id;
}

function insertShow(db, show) {
  logger.info({ showId: show.id }, 'Insert show');
  return upsertReturningId(
    db,
    `INSERT OR REPLACE INTO shows (sonarr_id, title, overview, path) VALUES (?, ?, ?, ?)`,
    [show.id, show.title || '', show.overview || '', show.path || ''],
    `SELECT id FROM shows WHERE sonarr_id = ?`,
    [show.id]
  );
}

function insertSeason(db, showId, seasonNumber) {
  logger.debug({ showId, seasonNumber }, 'Insert season');
  return upsertReturningId(
    db,
    `INSERT OR IGNORE INTO seasons (show_id, season_number) VALUES (?, ?)`,
    [showId, seasonNumber],
    `SELECT id FROM seasons WHERE show_id = ? AND season_number = ?`,
    [showId, seasonNumber]
  );
}

function insertEpisode(db, seasonId, ep) {
  logger.debug({ episodeId: ep.id }, 'Insert episode');
  return upsertReturningId(
    db,
    `INSERT OR REPLACE INTO episodes (season_id, episode_number, title, sonarr_episode_id) VALUES (?, ?, ?, ?)`,
    [seasonId, ep.episodeNumber || null, ep.title || '', ep.id],
    `SELECT id FROM episodes WHERE sonarr_episode_id = ?`,
    [ep.id]
  );
}

function insertEpisodeFile(db, episodeId, file) {
  logger.debug({ episodeId, path: file.path }, 'Insert file');
  return db.prepare(
    `INSERT INTO episode_files (episode_id, file_path, size, quality) VALUES (?, ?, ?, ?)`
  ).run(
    episodeId,
    file.path || '',
    file.size || 0,
    file.quality?.quality?.name || 'Unknown'
  ).lastInsertRowid;
}

function processShowData(db, show, episodes = [], files = []) {
  logger.info({ showId: show.id, count: episodes.length }, 'Process show');
  return db.transaction(() => {
    const showDbId = insertShow(db, show);
    const seasonMap = new Map(), epMap = new Map();
    episodes.forEach(ep => {
      const sid = seasonMap.get(ep.seasonNumber)
        || insertSeason(db, showDbId, ep.seasonNumber);
      seasonMap.set(ep.seasonNumber, sid);
      epMap.set(ep.id, insertEpisode(db, sid, ep));
    });
    files.forEach(f => {
      const eid = epMap.get(f.episodeId);
      if (eid) insertEpisodeFile(db, eid, f);
    });
  })();
}

function batchInsertShows(db, shows) {
  logger.info({ showCount: shows.length }, 'Batch insert shows');
  return db.transaction(() => {
    const stmt = db.prepare(
      `INSERT OR IGNORE INTO shows (title, path, sonarr_id, overview, status) VALUES (?, ?, ?, ?, ?)`
    );
    shows.forEach(s => {
      try { stmt.run(s.title || '', s.path || '', s.id, s.overview || '', s.status || ''); }
      catch { logger.warn({ showId: s.id }, 'Batch insert error'); }
    });
  })();
}

function getImportedShows(db, page = 1, pageSize = 100) {
  const p = Math.max(1, +page), sz = Math.max(1, +pageSize), offset = (p - 1) * sz;
  logger.info({ page: p, pageSize: sz }, 'Fetch shows');
  const shows = db.prepare(
    `SELECT s.id, s.title, s.path, s.sonarr_id, s.status, s.added_at,
            COUNT(e.id) AS episode_count
       FROM shows s
  LEFT JOIN seasons se ON se.show_id = s.id
  LEFT JOIN episodes e ON e.season_id = se.id
      GROUP BY s.id
      ORDER BY s.title
      LIMIT ? OFFSET ?`
  ).all(sz, offset);
  const total = db.prepare(`SELECT COUNT(*) AS count FROM shows`).get().count;
  return { shows, total, page: p, pageSize: sz, totalPages: Math.ceil(total / sz) };
}

function getSetting(db, key, defaultValue = null) {
  const row = db.prepare(`SELECT value FROM settings WHERE key = ?`).get(key);
  return row ? row.value : defaultValue;
}

function setSetting(db, key, value) {
  db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`).run(key, value);
}

function getShowStats(db, sonarrId) {
  const stats = db.prepare(
    `SELECT s.id, s.title, s.sonarr_id, s.status,
            COUNT(DISTINCT se.id) AS season_count,
            COUNT(DISTINCT e.id) AS episode_count,
            COUNT(DISTINCT ef.id) AS file_count
       FROM shows s
  LEFT JOIN seasons se ON se.show_id = s.id
  LEFT JOIN episodes e ON e.season_id = se.id
  LEFT JOIN episode_files ef ON ef.episode_id = e.id
      WHERE s.sonarr_id = ?
      GROUP BY s.id`
  ).get(sonarrId);
  return stats || null;
}

function withPerformanceLogging(name, fn) {
  const start = process.hrtime.bigint();
  try {
    logger.info({ operation: name }, 'Start');
    const result = fn();
    logger.info({
      operation: name,
      duration: `${Number(process.hrtime.bigint() - start) / 1e6}ms`,
      success: true
    }, 'Done');
    return result;
  } catch (err) {
    logger.error({
      operation: name,
      duration: `${Number(process.hrtime.bigint() - start) / 1e6}ms`,
      error: err.message
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
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('import_mode', mode);
  } catch (error) {
    logger.error('Failed to set import mode:', error);
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
  getShowStats,
  withPerformanceLogging,
  getImportMode,
  setImportMode,
  logger
};
