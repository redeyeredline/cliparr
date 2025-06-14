import pg from 'pg';
import { logger } from '../logger.js';

// Default database configuration
const DB_CONFIG = {
  host: 'localhost',
  port: 5432,
  database: 'cliparr',
  user: 'postgres',
  password: 'postgres',
};

// Log database configuration (excluding password)
const logConfig = { ...DB_CONFIG };
delete logConfig.password;
logger.info('Database manager configuration:', logConfig);

// Log connection string (excluding password)
const getConnectionString = (config) => {
  return `postgresql://${config.user}@${config.host}:${config.port}/${config.database}`;
};

logger.info('Database manager connection string:', getConnectionString(logConfig));

// Create a pool of connections
const pool = new pg.Pool(DB_CONFIG);

// Test the connection
pool.on('connect', (client) => {
  logger.info('New client connected to database pool', {
    host: client.connectionParameters.host,
    port: client.connectionParameters.port,
    database: client.connectionParameters.database,
    user: client.connectionParameters.user,
    connectionString: getConnectionString(client.connectionParameters)
  });
});

pool.on('error', (err, client) => {
  logger.error('Unexpected error on idle client', {
    error: err.message,
    code: err.code,
    detail: err.detail,
    hint: err.hint,
    where: err.where,
    client: client ? {
      host: client.connectionParameters.host,
      port: client.connectionParameters.port,
      database: client.connectionParameters.database,
      user: client.connectionParameters.user,
      connectionString: getConnectionString(client.connectionParameters)
    } : 'unknown'
  });
  process.exit(-1);
});

/**
 * Execute a query with performance logging
 * @param {string} text - SQL query text
 * @param {Array} params - Query parameters
 * @returns {Promise<pg.QueryResult>}
 */
async function query(text, params) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.info('Executed query', { 
      text, 
      duration, 
      rows: res.rowCount,
      host: pool.options.host,
      port: pool.options.port,
      database: pool.options.database,
      connectionString: getConnectionString(pool.options)
    });
    return res;
  } catch (error) {
    logger.error('Error executing query', { 
      text, 
      error: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
      where: error.where,
      host: pool.options.host,
      port: pool.options.port,
      database: pool.options.database,
      connectionString: getConnectionString(pool.options)
    });
    throw error;
  }
}

/**
 * Insert a show into the database
 * @param {Object} show - Show data from Sonarr
 * @returns {Promise<number>} - The ID of the inserted show
 */
async function insertShow(show) {
  const { rows } = await query(
    `INSERT INTO shows (sonarr_id, title, overview, path)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (sonarr_id) DO UPDATE
     SET title = EXCLUDED.title,
         overview = EXCLUDED.overview,
         path = EXCLUDED.path
     RETURNING id`,
    [show.id, show.title || '', show.overview || '', show.path || '']
  );
  return rows[0].id;
}

/**
 * Insert a season into the database
 * @param {number} showId - The ID of the show
 * @param {number} seasonNumber - The season number
 * @returns {Promise<number>} - The ID of the inserted season
 */
async function insertSeason(showId, seasonNumber) {
  const { rows } = await query(
    `INSERT INTO seasons (show_id, season_number)
     VALUES ($1, $2)
     ON CONFLICT (show_id, season_number) DO UPDATE
     SET show_id = EXCLUDED.show_id
     RETURNING id`,
    [showId, seasonNumber]
  );
  return rows[0].id;
}

/**
 * Insert an episode into the database
 * @param {number} seasonId - The ID of the season
 * @param {Object} episode - Episode data from Sonarr
 * @returns {Promise<number>} - The ID of the inserted episode
 */
async function insertEpisode(seasonId, episode) {
  const { rows } = await query(
    `INSERT INTO episodes (season_id, episode_number, title, sonarr_episode_id)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (sonarr_episode_id) DO UPDATE
     SET season_id = EXCLUDED.season_id,
         episode_number = EXCLUDED.episode_number,
         title = EXCLUDED.title
     RETURNING id`,
    [seasonId, episode.episodeNumber, episode.title || '', episode.id]
  );
  return rows[0].id;
}

/**
 * Insert an episode file into the database
 * @param {number} episodeId - The ID of the episode
 * @param {Object} file - File data from Sonarr
 * @returns {Promise<number>} - The ID of the inserted file
 */
async function insertEpisodeFile(episodeId, file) {
  const { rows } = await query(
    `INSERT INTO episode_files (episode_id, file_path, size, quality)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [episodeId, file.path, file.size, file.quality.quality.name]
  );
  return rows[0].id;
}

/**
 * Get imported shows with pagination
 * @param {number} page - Page number
 * @param {number} pageSize - Number of items per page
 * @returns {Promise<Object>} - Object containing shows and total count
 */
async function getImportedShows(page = 1, pageSize = 100) {
  const offset = (page - 1) * pageSize;
  
  const { rows: shows } = await query(
    `WITH show_episodes AS (
      SELECT 
        s.id, 
        s.title, 
        s.path, 
        s.sonarr_id,
        COUNT(DISTINCT e.id) as episode_count
      FROM shows s
      LEFT JOIN seasons se ON se.show_id = s.id
      LEFT JOIN episodes e ON e.season_id = se.id
      GROUP BY s.id, s.title, s.path, s.sonarr_id
    )
    SELECT 
      id, 
      title, 
      path, 
      sonarr_id, 
      episode_count
    FROM show_episodes
    ORDER BY title COLLATE "C"
    LIMIT $1 OFFSET $2`,
    [pageSize, offset]
  );

  const { rows: [{ count }] } = await query(
    'SELECT COUNT(*) FROM shows'
  );

  return {
    shows,
    total: parseInt(count),
    page,
    pageSize
  };
}

/**
 * Get unimported shows from Sonarr
 * @returns {Promise<Array>} - Array of unimported shows
 */
async function getUnimportedShows() {
  const { rows } = await query(
    `SELECT s.sonarr_id
     FROM shows s
     WHERE s.sonarr_id IS NOT NULL`
  );
  
  const importedIds = new Set(rows.map(row => row.sonarr_id));
  return importedIds;
}

/**
 * Get or set a setting value
 * @param {string} key - Setting key
 * @param {*} value - Setting value (optional)
 * @returns {Promise<*>} - Setting value
 */
async function setting(key, value = undefined) {
  if (value === undefined) {
    const { rows } = await query(
      'SELECT value FROM settings WHERE key = $1',
      [key]
    );
    return rows[0]?.value;
  }

  await query(
    `INSERT INTO settings (key, value)
     VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE
     SET value = EXCLUDED.value`,
    [key, value]
  );
  return value;
}

export {
  query,
  insertShow,
  insertSeason,
  insertEpisode,
  insertEpisodeFile,
  getImportedShows,
  getUnimportedShows,
  setting
}; 