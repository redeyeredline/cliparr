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

export interface EpisodeFile {
  id: number;
  episode_id: number;
  file_path: string;
  size: number;
  quality: string;
}

export class EpisodeFileModel {
  private pool: Pool;

  constructor() {
    this.pool = pool;
  }

  async insertEpisodeFile(file: Omit<EpisodeFile, 'id'>): Promise<number> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `INSERT INTO episode_files (episode_id, file_path, size, quality)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (episode_id) DO UPDATE
         SET file_path = EXCLUDED.file_path,
             size = EXCLUDED.size,
             quality = EXCLUDED.quality
         RETURNING id`,
        [file.episode_id, file.file_path, file.size, file.quality]
      );
      return result.rows[0].id;
    } catch (error) {
      logger.error('Error inserting episode file:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async getEpisodeFileByEpisodeId(episodeId: number): Promise<EpisodeFile | null> {
    const client = await this.pool.connect();
    try {
      const result = await client.query('SELECT * FROM episode_files WHERE episode_id = $1', [
        episodeId,
      ]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error getting episode file by episode id:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async deleteEpisodeFile(id: number): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('DELETE FROM episode_files WHERE id = $1', [id]);
    } catch (error) {
      logger.error('Error deleting episode file:', error);
      throw error;
    } finally {
      client.release();
    }
  }
}

export const episodeFileModel = new EpisodeFileModel();
