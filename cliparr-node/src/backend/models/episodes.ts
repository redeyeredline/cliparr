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

export interface Episode {
  id: number;
  season_id: number;
  episode_number: number;
  title: string;
  sonarr_episode_id: number;
}

export interface EpisodeWithFile extends Episode {
  file_path?: string;
  file_size?: number;
  quality?: string;
}

export class EpisodeModel {
  private pool: Pool;

  constructor() {
    this.pool = pool;
  }

  async insertEpisode(episode: Omit<Episode, 'id'>): Promise<number> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `INSERT INTO episodes (season_id, episode_number, title, sonarr_episode_id)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (sonarr_episode_id) DO UPDATE
         SET season_id = EXCLUDED.season_id,
             episode_number = EXCLUDED.episode_number,
             title = EXCLUDED.title
         RETURNING id`,
        [episode.season_id, episode.episode_number, episode.title, episode.sonarr_episode_id]
      );
      return result.rows[0].id;
    } catch (error) {
      logger.error('Error inserting episode:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async getEpisodesBySeasonId(seasonId: number): Promise<EpisodeWithFile[]> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `SELECT e.*, ef.file_path, ef.size as file_size, ef.quality
         FROM episodes e
         LEFT JOIN episode_files ef ON e.id = ef.episode_id
         WHERE e.season_id = $1
         ORDER BY e.episode_number`,
        [seasonId]
      );
      return result.rows;
    } catch (error) {
      logger.error('Error getting episodes by season id:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async getEpisodeById(id: number): Promise<EpisodeWithFile | null> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `SELECT e.*, ef.file_path, ef.size as file_size, ef.quality
         FROM episodes e
         LEFT JOIN episode_files ef ON e.id = ef.episode_id
         WHERE e.id = $1`,
        [id]
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error getting episode by id:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async getEpisodeBySonarrId(sonarrEpisodeId: number): Promise<Episode | null> {
    const client = await this.pool.connect();
    try {
      const result = await client.query('SELECT * FROM episodes WHERE sonarr_episode_id = $1', [
        sonarrEpisodeId,
      ]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error getting episode by Sonarr ID:', error);
      throw error;
    } finally {
      client.release();
    }
  }
}

export const episodeModel = new EpisodeModel();
