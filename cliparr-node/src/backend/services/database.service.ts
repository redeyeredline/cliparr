import { pool } from '../config/database';
import { logger } from '../utils/logger';

export class DatabaseService {
  // Show operations
  async getShows(page: number = 1, limit: number = 10) {
    const offset = (page - 1) * limit;
    const startTime = Date.now();
    
    try {
      const result = await pool.query(
        'SELECT * FROM shows ORDER BY created_at DESC LIMIT $1 OFFSET $2',
        [limit, offset]
      );
      
      const countResult = await pool.query('SELECT COUNT(*) FROM shows');
      const total = parseInt(countResult.rows[0].count);
      
      logger.info('Performance metric', {
        operation: 'getShows',
        duration: Date.now() - startTime,
        performance: true
      });
      
      return {
        shows: result.rows,
        total,
        page,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      logger.error('Error fetching shows:', error);
      throw error;
    }
  }

  async getShowById(id: number) {
    const startTime = Date.now();
    try {
      const result = await pool.query('SELECT * FROM shows WHERE id = $1', [id]);
      
      logger.info('Performance metric', {
        operation: 'getShowById',
        duration: Date.now() - startTime,
        performance: true
      });
      
      return result.rows[0];
    } catch (error) {
      logger.error('Error fetching show by ID:', error);
      throw error;
    }
  }

  async createShow(showData: {
    sonarr_id: number;
    title: string;
    path: string;
    status: string;
  }) {
    const startTime = Date.now();
    try {
      const result = await pool.query(
        'INSERT INTO shows (sonarr_id, title, path, status) VALUES ($1, $2, $3, $4) RETURNING *',
        [showData.sonarr_id, showData.title, showData.path, showData.status]
      );
      
      logger.info('Performance metric', {
        operation: 'createShow',
        duration: Date.now() - startTime,
        performance: true
      });
      
      return result.rows[0];
    } catch (error) {
      logger.error('Error creating show:', error);
      throw error;
    }
  }

  // Episode operations
  async getEpisodes(showId: number, page: number = 1, limit: number = 10) {
    const offset = (page - 1) * limit;
    const startTime = Date.now();
    
    try {
      const result = await pool.query(
        'SELECT * FROM episodes WHERE show_id = $1 ORDER BY season_number, episode_number LIMIT $2 OFFSET $3',
        [showId, limit, offset]
      );
      
      const countResult = await pool.query(
        'SELECT COUNT(*) FROM episodes WHERE show_id = $1',
        [showId]
      );
      const total = parseInt(countResult.rows[0].count);
      
      logger.info('Performance metric', {
        operation: 'getEpisodes',
        duration: Date.now() - startTime,
        performance: true
      });
      
      return {
        episodes: result.rows,
        total,
        page,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      logger.error('Error fetching episodes:', error);
      throw error;
    }
  }

  async createEpisode(episodeData: {
    show_id: number;
    sonarr_id: number;
    season_number: number;
    episode_number: number;
    title: string;
    path: string;
    status: string;
  }) {
    const startTime = Date.now();
    try {
      const result = await pool.query(
        'INSERT INTO episodes (show_id, sonarr_id, season_number, episode_number, title, path, status) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
        [
          episodeData.show_id,
          episodeData.sonarr_id,
          episodeData.season_number,
          episodeData.episode_number,
          episodeData.title,
          episodeData.path,
          episodeData.status
        ]
      );
      
      logger.info('Performance metric', {
        operation: 'createEpisode',
        duration: Date.now() - startTime,
        performance: true
      });
      
      return result.rows[0];
    } catch (error) {
      logger.error('Error creating episode:', error);
      throw error;
    }
  }

  // Settings operations
  async getSetting(key: string) {
    const startTime = Date.now();
    try {
      const result = await pool.query(
        'SELECT value FROM settings WHERE key = $1',
        [key]
      );
      
      logger.info('Performance metric', {
        operation: 'getSetting',
        duration: Date.now() - startTime,
        performance: true
      });
      
      return result.rows[0]?.value;
    } catch (error) {
      logger.error('Error fetching setting:', error);
      throw error;
    }
  }

  async setSetting(key: string, value: string) {
    const startTime = Date.now();
    try {
      const result = await pool.query(
        'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2 RETURNING *',
        [key, value]
      );
      
      logger.info('Performance metric', {
        operation: 'setSetting',
        duration: Date.now() - startTime,
        performance: true
      });
      
      return result.rows[0];
    } catch (error) {
      logger.error('Error setting setting:', error);
      throw error;
    }
  }
} 