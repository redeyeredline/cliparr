import { Pool } from 'pg';
import pino from 'pino';
import pool from './db';

const logger = pino({
  transport:
    process.env.NODE_ENV !== 'production'
      ? {
          target: 'pino-pretty',
          options: { colorize: true },
        }
      : undefined,
});

export interface Show {
  id: number;
  sonarr_id: number;
  title: string;
  overview: string;
  path: string;
}

export interface ShowWithEpisodes extends Show {
  episode_count: number;
}

export class ShowModel {
  private pool: Pool;

  constructor() {
    this.pool = pool;
  }

  async insertShow(show: Omit<Show, 'id'>): Promise<number> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const result = await client.query(
        `INSERT INTO shows (sonarr_id, title, overview, path)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (sonarr_id) DO UPDATE
         SET title = EXCLUDED.title,
             overview = EXCLUDED.overview,
             path = EXCLUDED.path
         RETURNING id`,
        [show.sonarr_id, show.title, show.overview, show.path]
      );

      await client.query('COMMIT');
      return result.rows[0].id;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error inserting show:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async getImportedShows(
    page: number = 1,
    pageSize: number = 100
  ): Promise<{ shows: ShowWithEpisodes[]; total: number }> {
    const client = await this.pool.connect();
    try {
      const offset = (page - 1) * pageSize;

      const result = await client.query(
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
        ORDER BY title
        LIMIT $1 OFFSET $2`,
        [pageSize, offset]
      );

      const totalResult = await client.query('SELECT COUNT(*) FROM shows');
      const total = parseInt(totalResult.rows[0].count);

      return {
        shows: result.rows,
        total,
      };
    } catch (error) {
      logger.error('Error getting imported shows:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async getShowById(id: number): Promise<Show | null> {
    const client = await this.pool.connect();
    try {
      const result = await client.query('SELECT * FROM shows WHERE id = $1', [id]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error getting show by id:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async deleteShow(id: number): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Delete related records first
      await client.query(
        'DELETE FROM episode_files WHERE episode_id IN (SELECT id FROM episodes WHERE season_id IN (SELECT id FROM seasons WHERE show_id = $1))',
        [id]
      );
      await client.query(
        'DELETE FROM episodes WHERE season_id IN (SELECT id FROM seasons WHERE show_id = $1)',
        [id]
      );
      await client.query('DELETE FROM seasons WHERE show_id = $1', [id]);
      await client.query('DELETE FROM shows WHERE id = $1', [id]);

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error deleting show:', error);
      throw error;
    } finally {
      client.release();
    }
  }
}

export const showModel = new ShowModel();
