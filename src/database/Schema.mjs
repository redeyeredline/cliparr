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
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )`,
  
    // indexes
    `CREATE INDEX IF NOT EXISTS idx_shows_title            ON shows(title COLLATE NOCASE)`,
    `CREATE INDEX IF NOT EXISTS idx_seasons_show_id        ON seasons(show_id)`,
    `CREATE INDEX IF NOT EXISTS idx_episodes_season_id     ON episodes(season_id)`,
    `CREATE INDEX IF NOT EXISTS idx_episode_files_episode_id ON episode_files(episode_id)`
  ];
  
  // 2) Export both the raw list and a helper to get them:
  export { STATEMENTS };
  export default {
    getAll: () => STATEMENTS
  };
  