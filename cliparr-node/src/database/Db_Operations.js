const Database = require('better-sqlite3');
const pino = require('pino');
const path = require('path');

// Initialize logger
const logger = pino({
  level: 'info',
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => {
      return { level: label };
    }
  }
});

/**
 * Create an optimized database connection with performance settings
 * @param {string} dbPath - Path to the SQLite database file
 * @returns {Database} - Better-sqlite3 database instance
 */
function getDb(dbPath = 'data/cliparr.db') {
  try {
    logger.info({ dbPath }, 'Creating database connection');
    
    const db = new Database(dbPath, {
      timeout: 10000, // 10 second timeout for concurrent access
      verbose: (sql, params) => {
        logger.debug({ sql, params }, 'Executing SQL query');
      }
    });

    // Enable Write-Ahead Logging (WAL) for better concurrency
    db.pragma('journal_mode = WAL');
    
    // Optimize performance settings
    db.pragma('synchronous = NORMAL');
    db.pragma('cache_size = -16000'); // 16MB cache
    db.pragma('mmap_size = 30000000'); // Memory-mapped I/O
    
    logger.info('Database connection established with optimized settings');
    return db;
  } catch (error) {
    logger.error({ error: error.message, dbPath }, 'Failed to create database connection');
    throw error;
  }
}

/**
 * Insert or replace a show in the database
 * @param {Database} db - Database instance
 * @param {Object} show - Show object from Sonarr API
 * @returns {number} - The show's database ID
 */
function insertShow(db, show) {
  logger.info({ showId: show.id, title: show.title }, 'Inserting show into database');
  
  try {
    const insertStmt = db.prepare(`
      INSERT OR REPLACE INTO shows 
      (sonarr_id, title, overview, path) 
      VALUES (?, ?, ?, ?)
    `);
    
    const result = insertStmt.run(
      show.id,
      show.title || '',
      show.overview || '',
      show.path || ''
    );
    
    // If lastInsertRowid is 0, it means we replaced an existing record
    // In that case, we need to fetch the actual ID
    let showDbId;
    if (result.lastInsertRowid === 0) {
      logger.debug({ sonarrId: show.id }, 'Show already exists, fetching existing ID');
      const selectStmt = db.prepare('SELECT id FROM shows WHERE sonarr_id = ?');
      const existingRow = selectStmt.get(show.id);
      showDbId = existingRow.id;
    } else {
      showDbId = result.lastInsertRowid;
    }
    
    logger.info({ showDbId, sonarrId: show.id, title: show.title }, 'Show inserted successfully');
    return showDbId;
  } catch (error) {
    logger.error({ error: error.message, show }, 'Failed to insert show');
    throw error;
  }
}

/**
 * Insert a season into the database (if it doesn't exist)
 * @param {Database} db - Database instance
 * @param {number} showId - Show's database ID
 * @param {number} seasonNumber - Season number
 * @returns {number} - The season's database ID
 */
function insertSeason(db, showId, seasonNumber) {
  logger.debug({ showId, seasonNumber }, 'Inserting season into database');
  
  try {
    const insertStmt = db.prepare(`
      INSERT OR IGNORE INTO seasons 
      (show_id, season_number) 
      VALUES (?, ?)
    `);
    
    insertStmt.run(showId, seasonNumber);
    
    // Fetch the season ID (whether it was just inserted or already existed)
    const selectStmt = db.prepare(`
      SELECT id FROM seasons 
      WHERE show_id = ? AND season_number = ?
    `);
    
    const seasonRow = selectStmt.get(showId, seasonNumber);
    
    if (!seasonRow) {
      throw new Error(`Failed to find season after insert: showId=${showId}, seasonNumber=${seasonNumber}`);
    }
    
    logger.debug({ seasonId: seasonRow.id, showId, seasonNumber }, 'Season processed successfully');
    return seasonRow.id;
  } catch (error) {
    logger.error({ error: error.message, showId, seasonNumber }, 'Failed to insert season');
    throw error;
  }
}

/**
 * Insert or replace an episode in the database
 * @param {Database} db - Database instance
 * @param {number} seasonId - Season's database ID
 * @param {Object} episode - Episode object from Sonarr API
 * @returns {number} - The episode's database ID
 */
function insertEpisode(db, seasonId, episode) {
  logger.debug({ seasonId, episodeId: episode.id, title: episode.title }, 'Inserting episode into database');
  
  try {
    const insertStmt = db.prepare(`
      INSERT OR REPLACE INTO episodes 
      (season_id, episode_number, title, sonarr_episode_id) 
      VALUES (?, ?, ?, ?)
    `);
    
    const result = insertStmt.run(
      seasonId,
      episode.episodeNumber || null,
      episode.title || '',
      episode.id
    );
    
    // Handle case where we replaced an existing episode
    let episodeDbId;
    if (result.lastInsertRowid === 0) {
      logger.debug({ sonarrEpisodeId: episode.id }, 'Episode already exists, fetching existing ID');
      const selectStmt = db.prepare('SELECT id FROM episodes WHERE sonarr_episode_id = ?');
      const existingRow = selectStmt.get(episode.id);
      episodeDbId = existingRow.id;
    } else {
      episodeDbId = result.lastInsertRowid;
    }
    
    logger.debug({ episodeDbId, sonarrEpisodeId: episode.id }, 'Episode inserted successfully');
    return episodeDbId;
  } catch (error) {
    logger.error({ error: error.message, seasonId, episode }, 'Failed to insert episode');
    throw error;
  }
}

/**
 * Insert an episode file into the database
 * @param {Database} db - Database instance
 * @param {number} episodeId - Episode's database ID
 * @param {Object} file - Episode file object from Sonarr API
 * @returns {number} - The episode file's database ID
 */
function insertEpisodeFile(db, episodeId, file) {
  logger.debug({ episodeId, filePath: file.path }, 'Inserting episode file into database');
  
  try {
    const insertStmt = db.prepare(`
      INSERT INTO episode_files 
      (episode_id, file_path, size, quality) 
      VALUES (?, ?, ?, ?)
    `);
    
    const qualityName = file.quality?.quality?.name || 'Unknown';
    
    const result = insertStmt.run(
      episodeId,
      file.path || '',
      file.size || 0,
      qualityName
    );
    
    logger.debug({ episodeFileId: result.lastInsertRowid, episodeId, filePath: file.path }, 'Episode file inserted successfully');
    return result.lastInsertRowid;
  } catch (error) {
    logger.error({ error: error.message, episodeId, file }, 'Failed to insert episode file');
    throw error;
  }
}

/**
 * Process a complete show's data including episodes and files
 * @param {Database} db - Database instance
 * @param {Object} show - Show object from Sonarr API
 * @param {Array} episodes - Array of episode objects from Sonarr API
 * @param {Array} files - Array of episode file objects from Sonarr API
 */
function processShowData(db, show, episodes = [], files = []) {
  logger.info({ showId: show.id, title: show.title, episodeCount: episodes.length, fileCount: files.length }, 'Processing complete show data');
  
  try {
    // Use a transaction for better performance and data consistency
    const processTransaction = db.transaction(() => {
      // Insert the show
      const showDbId = insertShow(db, show);
      
      // Map episodes to their database IDs
      const episodeMap = new Map();
      
      // Process episodes grouped by season
      const seasonMap = new Map();
      
      for (const episode of episodes) {
        const seasonNumber = episode.seasonNumber;
        
        // Get or create season
        let seasonId;
        if (seasonMap.has(seasonNumber)) {
          seasonId = seasonMap.get(seasonNumber);
        } else {
          seasonId = insertSeason(db, showDbId, seasonNumber);
          seasonMap.set(seasonNumber, seasonId);
        }
        
        // Insert episode and map it
        const episodeDbId = insertEpisode(db, seasonId, episode);
        episodeMap.set(episode.id, episodeDbId);
      }
      
      // Process episode files
      let filesProcessed = 0;
      for (const file of files) {
        const sonarrEpisodeId = file.episodeId;
        if (episodeMap.has(sonarrEpisodeId)) {
          const episodeDbId = episodeMap.get(sonarrEpisodeId);
          insertEpisodeFile(db, episodeDbId, file);
          filesProcessed++;
        } else {
          logger.warn({ fileId: file.id, episodeId: sonarrEpisodeId }, 'Episode file references unknown episode, skipping');
        }
      }
      
      logger.info({ 
        showId: show.id, 
        title: show.title, 
        seasonsProcessed: seasonMap.size,
        episodesProcessed: episodes.length,
        filesProcessed 
      }, 'Show data processing completed');
    });
    
    // Execute the transaction
    processTransaction();
    
  } catch (error) {
    logger.error({ error: error.message, showId: show.id, title: show.title }, 'Failed to process show data');
    throw error;
  }
}

/**
 * Batch insert multiple shows with improved performance
 * @param {Database} db - Database instance
 * @param {Array} shows - Array of show objects
 */
function batchInsertShows(db, shows) {
  logger.info({ showCount: shows.length }, 'Starting batch insert of shows');
  
  try {
    const batchTransaction = db.transaction(() => {
      const insertStmt = db.prepare(`
        INSERT OR IGNORE INTO shows 
        (title, path, sonarr_id, overview, status) 
        VALUES (?, ?, ?, ?, ?)
      `);
      
      let successCount = 0;
      let errorCount = 0;
      
      for (const show of shows) {
        try {
          insertStmt.run(
            show.title || '',
            show.path || '',
            show.id,
            show.overview || '',
            show.status || ''
          );
          successCount++;
        } catch (error) {
          logger.warn({ error: error.message, showId: show.id, title: show.title }, 'Failed to insert individual show in batch');
          errorCount++;
        }
      }
      
      logger.info({ successCount, errorCount, totalShows: shows.length }, 'Batch insert completed');
    });
    
    batchTransaction();
    
  } catch (error) {
    logger.error({ error: error.message, showCount: shows.length }, 'Batch insert failed');
    throw error;
  }
}

/**
 * Get imported shows with pagination and episode counts
 * @param {Database} db - Database instance
 * @param {number} page - Page number (1-based)
 * @param {number} pageSize - Number of shows per page
 * @returns {Object} - Object containing shows array and pagination metadata
 */
function getImportedShows(db, page = 1, pageSize = 100) {
  logger.info({ page, pageSize }, 'Fetching imported shows with pagination');
  
  try {
    // Validate and sanitize input
    const validPage = Math.max(1, parseInt(page) || 1);
    const validPageSize = Math.max(1, parseInt(pageSize) || 100);
    
    const query = `
      WITH show_episodes AS (
        SELECT 
          s.id, 
          s.title, 
          s.path, 
          s.sonarr_id,
          s.status,
          s.added_at,
          COUNT(DISTINCT e.id) as episode_count,
          ROW_NUMBER() OVER (ORDER BY s.title COLLATE NOCASE) as row_num
        FROM shows s
        LEFT JOIN seasons se ON se.show_id = s.id
        LEFT JOIN episodes e ON e.season_id = se.id
        GROUP BY s.id, s.title, s.path, s.sonarr_id, s.status, s.added_at
      )
      SELECT 
        id, 
        title, 
        path, 
        sonarr_id, 
        status,
        added_at,
        episode_count
      FROM show_episodes
      WHERE row_num BETWEEN ? AND ?
      ORDER BY row_num
    `;
    
    // Calculate offset and limit
    const startRow = (validPage - 1) * validPageSize + 1;
    const endRow = startRow + validPageSize - 1;
    
    logger.debug({ page: validPage, pageSize: validPageSize, startRow, endRow }, 'Executing paginated query');
    
    const selectStmt = db.prepare(query);
    const shows = selectStmt.all(startRow, endRow);
    
    // Get total count for pagination metadata
    const totalCountStmt = db.prepare('SELECT COUNT(*) as total FROM shows');
    const totalResult = totalCountStmt.get();
    const totalCount = totalResult.total;
    
    const result = {
      shows,
      total: totalCount,
      page: validPage,
      pageSize: validPageSize,
      totalPages: Math.ceil(totalCount / validPageSize)
    };
    
    logger.info({ 
      showsReturned: shows.length, 
      totalShows: totalCount, 
      page: validPage, 
      totalPages: result.totalPages 
    }, 'Imported shows fetched successfully');
    
    return result;
    
  } catch (error) {
    logger.error({ error: error.message, page, pageSize }, 'Failed to fetch imported shows');
    throw error;
  }
}

/**
 * Get or set a configuration setting
 * @param {Database} db - Database instance
 * @param {string} key - Setting key
 * @param {string} defaultValue - Default value if key doesn't exist
 * @returns {string} - Setting value
 */
function getSetting(db, key, defaultValue = null) {
  logger.debug({ key, defaultValue }, 'Fetching setting from database');
  
  try {
    const selectStmt = db.prepare('SELECT value FROM settings WHERE key = ?');
    const row = selectStmt.get(key);
    
    const value = row ? row.value : defaultValue;
    logger.debug({ key, value, foundInDb: !!row }, 'Setting retrieved');
    
    return value;
  } catch (error) {
    logger.error({ error: error.message, key }, 'Failed to fetch setting');
    throw error;
  }
}

/**
 * Set a configuration setting
 * @param {Database} db - Database instance
 * @param {string} key - Setting key
 * @param {string} value - Setting value
 */
function setSetting(db, key, value) {
  logger.info({ key, value }, 'Setting configuration value');
  
  try {
    const insertStmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
    insertStmt.run(key, value);
    
    logger.info({ key, value }, 'Setting saved successfully');
  } catch (error) {
    logger.error({ error: error.message, key, value }, 'Failed to save setting');
    throw error;
  }
}

/**
 * Get show statistics including episode and file counts
 * @param {Database} db - Database instance
 * @param {number} sonarrId - Sonarr show ID
 * @returns {Object} - Show statistics object
 */
function getShowStats(db, sonarrId) {
  logger.debug({ sonarrId }, 'Fetching show statistics');
  
  try {
    const query = `
      SELECT 
        s.id,
        s.title,
        s.sonarr_id,
        s.status,
        COUNT(DISTINCT se.id) as season_count,
        COUNT(DISTINCT e.id) as episode_count,
        COUNT(DISTINCT ef.id) as file_count
      FROM shows s
      LEFT JOIN seasons se ON se.show_id = s.id
      LEFT JOIN episodes e ON e.season_id = se.id
      LEFT JOIN episode_files ef ON ef.episode_id = e.id
      WHERE s.sonarr_id = ?
      GROUP BY s.id, s.title, s.sonarr_id, s.status
    `;
    
    const selectStmt = db.prepare(query);
    const stats = selectStmt.get(sonarrId);
    
    if (!stats) {
      logger.warn({ sonarrId }, 'Show not found in database');
      return null;
    }
    
    logger.debug({ sonarrId, stats }, 'Show statistics retrieved');
    return stats;
    
  } catch (error) {
    logger.error({ error: error.message, sonarrId }, 'Failed to fetch show statistics');
    throw error;
  }
}

/**
 * Performance monitoring wrapper for database operations
 * @param {string} operationName - Name of the operation being monitored
 * @param {Function} operation - Function to execute and monitor
 * @returns {*} - Result of the operation
 */
function withPerformanceLogging(operationName, operation) {
  const startTime = process.hrtime.bigint();
  
  try {
    logger.info({ operation: operationName }, 'Starting database operation');
    
    const result = operation();
    
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
    
    logger.info({ 
      operation: operationName, 
      duration: `${duration.toFixed(2)}ms`,
      success: true
    }, 'Database operation completed');
    
    return result;
    
  } catch (error) {
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1000000;
    
    logger.error({ 
      operation: operationName, 
      duration: `${duration.toFixed(2)}ms`,
      error: error.message,
      success: false
    }, 'Database operation failed');
    
    throw error;
  }
}

// Export all functions for use in other modules
module.exports = {
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
  logger
};