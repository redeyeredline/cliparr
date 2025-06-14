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

export interface Season {
  id: number;
  show_id: number;
  season_number: number;
}

export class SeasonModel {
  private pool: Pool;

  constructor() {
    this.pool = pool;
  }

  async insertSeason(showId: number, seasonNumber: number): Promise<number> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `INSERT INTO seasons (show_id, season_number)
         VALUES ($1, $2)
         ON CONFLICT (show_id, season_number) DO UPDATE
         SET show_id = EXCLUDED.show_id,
             season_number = EXCLUDED.season_number
         RETURNING id`,
        [showId, seasonNumber]
      );
      return result.rows[0].id;
    } catch (error) {
      logger.error('Error inserting season:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async getSeasonsByShowId(showId: number): Promise<Season[]> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        'SELECT * FROM seasons WHERE show_id = $1 ORDER BY season_number',
        [showId]
      );
      return result.rows;
    } catch (error) {
      logger.error('Error getting seasons by show id:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async getSeasonById(id: number): Promise<Season | null> {
    const client = await this.pool.connect();
    try {
      const result = await client.query('SELECT * FROM seasons WHERE id = $1', [id]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error getting season by id:', error);
      throw error;
    } finally {
      client.release();
    }
  }
}

export const seasonModel = new SeasonModel();
