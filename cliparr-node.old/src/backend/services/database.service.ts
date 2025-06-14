import { db } from '../config/database';
import { logger } from '../utils/logger';

interface Show {
  id: number;
  sonarr_id: number;
  title: string;
  path: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface Episode {
  id: number;
  show_id: number;
  sonarr_id: number;
  season_number: number;
  episode_number: number;
  title: string;
  path: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface ImportedShow extends Show {
  episodes: Episode[];
}

interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

class DatabaseService {
  async getImportedShows(
    page: number = 1,
    pageSize: number = 10
  ): Promise<PaginatedResponse<ImportedShow>> {
    try {
      // Get total count
      const countStmt = db.prepare('SELECT COUNT(*) as count FROM shows');
      const countResult = countStmt.get() as { count: number };
      const total = countResult?.count || 0;

      // Calculate pagination
      const offset = (page - 1) * pageSize;
      const totalPages = Math.ceil(total / pageSize);

      // Get shows with pagination
      const showsStmt = db.prepare('SELECT * FROM shows ORDER BY title LIMIT ? OFFSET ?');
      const shows = showsStmt.all(pageSize, offset) as Show[];

      // Get episodes for each show
      const episodesStmt = db.prepare(
        'SELECT * FROM episodes WHERE show_id = ? ORDER BY season_number, episode_number'
      );
      const showsWithEpisodes = shows.map(show => {
        const episodes = episodesStmt.all(show.id) as Episode[];
        return { ...show, episodes };
      });

      return {
        items: showsWithEpisodes,
        total,
        page,
        pageSize,
        totalPages,
      };
    } catch (error) {
      logger.error('Error getting imported shows:', error);
      throw error;
    }
  }

  async getShowById(showId: number): Promise<ImportedShow | null> {
    try {
      const showStmt = db.prepare('SELECT * FROM shows WHERE id = ?');
      const show = showStmt.get(showId) as Show | undefined;
      if (!show) return null;

      const episodesStmt = db.prepare(
        'SELECT * FROM episodes WHERE show_id = ? ORDER BY season_number, episode_number'
      );
      const episodes = episodesStmt.all(showId) as Episode[];

      return { ...show, episodes };
    } catch (error) {
      logger.error(`Error getting show ${showId}:`, error);
      throw error;
    }
  }

  async getShowBySonarrId(sonarrId: number): Promise<ImportedShow | null> {
    try {
      const showStmt = db.prepare('SELECT * FROM shows WHERE sonarr_id = ?');
      const show = showStmt.get(sonarrId) as Show | undefined;
      if (!show) return null;

      const episodesStmt = db.prepare(
        'SELECT * FROM episodes WHERE show_id = ? ORDER BY season_number, episode_number'
      );
      const episodes = episodesStmt.all(show.id) as Episode[];

      return { ...show, episodes };
    } catch (error) {
      logger.error(`Error getting show with Sonarr ID ${sonarrId}:`, error);
      throw error;
    }
  }

  async saveShow(show: Omit<Show, 'id' | 'created_at' | 'updated_at'>): Promise<Show> {
    try {
      const stmt = db.prepare(`
        INSERT INTO shows (sonarr_id, title, path, status)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(sonarr_id) DO UPDATE SET
        title = excluded.title,
        path = excluded.path,
        status = excluded.status,
        updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `);
      const result = stmt.get(show.sonarr_id, show.title, show.path, show.status) as Show;

      return result;
    } catch (error) {
      logger.error('Error saving show:', error);
      throw error;
    }
  }

  async saveEpisode(episode: Omit<Episode, 'id' | 'created_at' | 'updated_at'>): Promise<Episode> {
    try {
      const stmt = db.prepare(`
        INSERT INTO episodes (show_id, sonarr_id, season_number, episode_number, title, path, status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(sonarr_id) DO UPDATE SET
        show_id = excluded.show_id,
        season_number = excluded.season_number,
        episode_number = excluded.episode_number,
        title = excluded.title,
        path = excluded.path,
        status = excluded.status,
        updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `);
      const result = stmt.get(
        episode.show_id,
        episode.sonarr_id,
        episode.season_number,
        episode.episode_number,
        episode.title,
        episode.path,
        episode.status
      ) as Episode;

      return result;
    } catch (error) {
      logger.error('Error saving episode:', error);
      throw error;
    }
  }

  async deleteShow(showId: number): Promise<void> {
    try {
      const stmt = db.prepare('DELETE FROM shows WHERE id = ?');
      stmt.run(showId);
    } catch (error) {
      logger.error(`Error deleting show ${showId}:`, error);
      throw error;
    }
  }

  async getImportMode(): Promise<string> {
    try {
      const stmt = db.prepare('SELECT value FROM settings WHERE key = ?');
      const result = stmt.get('import_mode') as { value: string } | undefined;
      return result?.value || 'none';
    } catch (error) {
      logger.error('Error getting import mode:', error);
      throw error;
    }
  }

  async setImportMode(mode: string): Promise<void> {
    try {
      const stmt = db.prepare(
        'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?'
      );
      stmt.run('import_mode', mode, mode);
    } catch (error) {
      logger.error('Error setting import mode:', error);
      throw error;
    }
  }
}

export default new DatabaseService();
