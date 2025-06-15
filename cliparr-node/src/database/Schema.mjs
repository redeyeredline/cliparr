// src/database/schema.js

// 1) Define your SQL statements in one place:
const STATEMENTS = [
    // tables
    `
    CREATE TABLE IF NOT EXISTS shows (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      sonarr_id INTEGER UNIQUE,
      path TEXT,
      overview TEXT,
      status TEXT,
      added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `
    CREATE TABLE IF NOT EXISTS seasons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      show_id INTEGER,
      season_number INTEGER,
      monitored BOOLEAN DEFAULT 1,
      FOREIGN KEY (show_id) REFERENCES shows(id) ON DELETE CASCADE,
      UNIQUE(show_id, season_number)
    )`,
    `
    CREATE TABLE IF NOT EXISTS episodes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      season_id INTEGER,
      sonarr_episode_id INTEGER UNIQUE,
      episode_number INTEGER,
      title TEXT,
      monitored BOOLEAN DEFAULT 1,
      FOREIGN KEY (season_id) REFERENCES seasons(id) ON DELETE CASCADE
    )`,
    `
    CREATE TABLE IF NOT EXISTS episode_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      episode_id INTEGER,
      file_path TEXT,
      size INTEGER,
      quality TEXT,
      FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE CASCADE
    )`,
    `
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )`,
  
    // indexes
    `CREATE INDEX IF NOT EXISTS idx_shows_title            ON shows(title COLLATE NOCASE)`,
    `CREATE INDEX IF NOT EXISTS idx_shows_sonarr_id        ON shows(sonarr_id)`,
    `CREATE INDEX IF NOT EXISTS idx_seasons_show_id        ON seasons(show_id)`,
    `CREATE INDEX IF NOT EXISTS idx_episodes_season_id     ON episodes(season_id)`,
    `CREATE INDEX IF NOT EXISTS idx_episodes_sonarr_ep_id  ON episodes(sonarr_episode_id)`
  ];
  
  // 2) Export both the raw list and a helper to get them:
  export { STATEMENTS };
  export default {
    getAll: () => STATEMENTS
  };
  