import sqlite3
import os
import logging
from pathlib import Path
from .constants import DB_PATH

def init_db(db_path=None):
    """
    Initialize the database with all necessary tables.
    
    :param db_path: Path to the SQLite database file
    """
    db_path = db_path or DB_PATH
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
                sonarr_id INTEGER UNIQUE,
                title TEXT,
                overview TEXT,
                path TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        # Create seasons table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS seasons (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                show_id INTEGER,
                season_number INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (show_id) REFERENCES shows (id),
                UNIQUE(show_id, season_number)
            )
        ''')

        # Create episodes table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS episodes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                season_id INTEGER,
                episode_number INTEGER,
                title TEXT,
                sonarr_episode_id INTEGER UNIQUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (season_id) REFERENCES seasons (id)
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
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (episode_id) REFERENCES episodes (id)
            )
        ''')

        # Create settings table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        # Create indexes for better performance
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_shows_sonarr_id ON shows(sonarr_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_seasons_show_id ON seasons(show_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_episodes_season_id ON episodes(season_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_episode_files_episode_id ON episode_files(episode_id)')

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
