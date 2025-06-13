import sqlite3
import os
import logging
from pathlib import Path

def init_db(db_path='data/cliparr.db'):
    """
    Initialize the database with all necessary tables.
    
    :param db_path: Path to the SQLite database file
    """
    try:
        # Ensure the directory exists
        os.makedirs(os.path.dirname(db_path), exist_ok=True)

        # Connect to the database
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        # Create shows table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS shows (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                sonarr_id INTEGER UNIQUE,
                path TEXT,
                overview TEXT,
                status TEXT,
                added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        # Create seasons table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS seasons (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                show_id INTEGER,
                season_number INTEGER,
                monitored BOOLEAN DEFAULT 1,
                FOREIGN KEY (show_id) REFERENCES shows(id) ON DELETE CASCADE,
                UNIQUE(show_id, season_number)
            )
        ''')

        # Create episodes table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS episodes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                season_id INTEGER,
                sonarr_episode_id INTEGER UNIQUE,
                episode_number INTEGER,
                title TEXT,
                monitored BOOLEAN DEFAULT 1,
                FOREIGN KEY (season_id) REFERENCES seasons(id) ON DELETE CASCADE
            )
        ''')

        # Create episode_files table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS episode_files (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                episode_id INTEGER,
                file_path TEXT,
                size INTEGER,
                quality TEXT,
                FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE CASCADE
            )
        ''')

        # Create settings table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT
            )
        ''')

        # Create indexes for performance
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_shows_title ON shows(title COLLATE NOCASE)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_shows_sonarr_id ON shows(sonarr_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_seasons_show_id ON seasons(show_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_episodes_season_id ON episodes(season_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_episodes_sonarr_episode_id ON episodes(sonarr_episode_id)')

        # Commit changes
        conn.commit()

        # Log successful initialization
        logging.info(f"Database initialized successfully at {db_path}")

    except sqlite3.Error as e:
        logging.error(f"Error initializing database: {e}")
        raise
    finally:
        if conn:
            conn.close()
# Run initialization if this script is run directly
if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO)
    init_db()
