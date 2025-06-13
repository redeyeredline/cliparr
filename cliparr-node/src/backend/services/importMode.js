const { pool } = require('../db');

class ImportModeService {
  async getImportMode() {
    const client = await pool.connect();
    try {
      const result = await client.query(
        'SELECT value FROM settings WHERE key = $1',
        ['import_mode']
      );
      return result.rows[0]?.value || 'auto';
    } finally {
      client.release();
    }
  }

  async setImportMode(mode) {
    if (!['auto', 'import'].includes(mode)) {
      throw new Error('Invalid import mode. Must be either "auto" or "import"');
    }

    const client = await pool.connect();
    try {
      await client.query(
        `INSERT INTO settings (key, value) 
         VALUES ($1, $2) 
         ON CONFLICT (key) 
         DO UPDATE SET value = $2, updated_at = CURRENT_TIMESTAMP`,
        ['import_mode', mode]
      );
      return mode;
    } finally {
      client.release();
    }
  }

  async getImportedShows(page = 1, pageSize = 100) {
    const client = await pool.connect();
    try {
      const offset = (page - 1) * pageSize;
      const result = await client.query(
        `SELECT s.*, 
                COUNT(DISTINCT e.id) as episode_count,
                COUNT(DISTINCT ef.id) as file_count
         FROM shows s
         LEFT JOIN seasons sn ON s.id = sn.show_id
         LEFT JOIN episodes e ON sn.id = e.season_id
         LEFT JOIN episode_files ef ON e.id = ef.episode_id
         GROUP BY s.id
         ORDER BY s.title
         LIMIT $1 OFFSET $2`,
        [pageSize, offset]
      );
      return result.rows;
    } finally {
      client.release();
    }
  }

  async importShow(sonarrId) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Check if show is already imported
      const existingShow = await client.query(
        'SELECT id FROM shows WHERE sonarr_id = $1',
        [sonarrId]
      );

      if (existingShow.rows.length > 0) {
        throw new Error('Show is already imported');
      }

      // Import the show
      const result = await client.query(
        'INSERT INTO shows (sonarr_id) VALUES ($1) RETURNING id',
        [sonarrId]
      );

      await client.query('COMMIT');
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async deleteImportedShow(showId) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Delete episode files first
      await client.query(
        `DELETE FROM episode_files 
         WHERE episode_id IN (
           SELECT e.id FROM episodes e
           JOIN seasons s ON e.season_id = s.id
           WHERE s.show_id = $1
         )`,
        [showId]
      );

      // Delete episodes
      await client.query(
        `DELETE FROM episodes 
         WHERE season_id IN (
           SELECT id FROM seasons WHERE show_id = $1
         )`,
        [showId]
      );

      // Delete seasons
      await client.query(
        'DELETE FROM seasons WHERE show_id = $1',
        [showId]
      );

      // Delete the show
      await client.query(
        'DELETE FROM shows WHERE id = $1',
        [showId]
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = new ImportModeService(); 