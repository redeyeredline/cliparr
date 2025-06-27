// Database schema definition containing table creation statements and indexes.
// Defines the structure for shows, seasons, episodes, files, and settings tables.

// 1) Define your SQL statements in one place:
const STATEMENTS = [
    // tables
    `
    CREATE TABLE IF NOT EXISTS shows (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sonarr_id INTEGER,
      sonarr_instance_id TEXT,
      title TEXT NOT NULL,
      path TEXT,
      UNIQUE(sonarr_id, sonarr_instance_id)
    )`,
    `
    CREATE TABLE IF NOT EXISTS seasons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      show_id INTEGER,
      season_number INTEGER,
      FOREIGN KEY (show_id) REFERENCES shows(id) ON DELETE CASCADE,
      UNIQUE(show_id, season_number)
    )`,
    `
    CREATE TABLE IF NOT EXISTS episodes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      season_id INTEGER,
      episode_number INTEGER,
      title TEXT,
      FOREIGN KEY (season_id) REFERENCES seasons(id) ON DELETE CASCADE
    )`,
    `
    CREATE TABLE IF NOT EXISTS episode_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      episode_id INTEGER,
      file_path TEXT,
      size INTEGER,
      FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE CASCADE
    )`,
    `
    CREATE TABLE IF NOT EXISTS processing_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      media_file_id INTEGER,
      profile_id INTEGER,
      status TEXT DEFAULT 'scanning',
      confidence_score REAL DEFAULT 0.0,
      intro_start REAL,
      intro_end REAL,
      credits_start REAL,
      credits_end REAL,
      manual_verified BOOLEAN DEFAULT 0,
      processing_notes TEXT,
      created_date TEXT,
      updated_date TEXT,
      FOREIGN KEY (media_file_id) REFERENCES episode_files(id) ON DELETE CASCADE
    )`,
    `
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )`,
  
    // indexes
    `CREATE INDEX IF NOT EXISTS idx_shows_title            ON shows(title COLLATE NOCASE)`,
    `CREATE INDEX IF NOT EXISTS idx_seasons_show_id        ON seasons(show_id)`,
    `CREATE INDEX IF NOT EXISTS idx_episodes_season_id     ON episodes(season_id)`,
    `CREATE INDEX IF NOT EXISTS idx_episode_files_episode_id ON episode_files(episode_id)`,
    `CREATE INDEX IF NOT EXISTS idx_processing_jobs_status ON processing_jobs(status)`,
    `CREATE INDEX IF NOT EXISTS idx_processing_jobs_media_file_id ON processing_jobs(media_file_id)`,
    `CREATE INDEX IF NOT EXISTS idx_processing_jobs_created_date ON processing_jobs(created_date)`
  ];
  
  // 2) Export both the raw list and a helper to get them:
  export { STATEMENTS };
  export default {
    getAll: () => STATEMENTS
  };
  