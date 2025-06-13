"""
Database initialization module.
"""

import sqlite3
import os
import logging
from pathlib import Path
from ..config import DB_PATH, LOG_DIR

logger = logging.getLogger(__name__)

def init_db():
    """
    Initialize the database with all necessary tables and indexes.
    """
    try:
        # Ensure the directory exists
        os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
        
        # Connect to the database
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Enable foreign keys
        cursor.execute('PRAGMA foreign_keys = ON')
        
        # Enable Write-Ahead Logging for better concurrency
        cursor.execute('PRAGMA journal_mode = WAL')
        
        # Optimize performance settings
        cursor.execute('PRAGMA synchronous = NORMAL')
        cursor.execute('PRAGMA cache_size = -16000')  # 16MB cache
        cursor.execute('PRAGMA mmap_size = 30000000')  # Memory-mapped I/O
        
        # Drop existing tables if they exist
        cursor.execute('DROP TABLE IF EXISTS episode_files')
        cursor.execute('DROP TABLE IF EXISTS episodes')
        cursor.execute('DROP TABLE IF EXISTS seasons')
        cursor.execute('DROP TABLE IF EXISTS shows')
        cursor.execute('DROP TABLE IF EXISTS settings')
        
        # Create shows table
        cursor.execute('''
            CREATE TABLE shows (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sonarr_id INTEGER UNIQUE NOT NULL,
                title TEXT NOT NULL,
                overview TEXT,
                path TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Create seasons table
        cursor.execute('''
            CREATE TABLE seasons (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                show_id INTEGER NOT NULL,
                season_number INTEGER NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (show_id) REFERENCES shows(id),
                UNIQUE(show_id, season_number)
            )
        ''')
        
        # Create episodes table
        cursor.execute('''
            CREATE TABLE episodes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                season_id INTEGER NOT NULL,
                episode_number INTEGER NOT NULL,
                title TEXT NOT NULL,
                sonarr_episode_id INTEGER UNIQUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (season_id) REFERENCES seasons(id),
                UNIQUE(season_id, episode_number)
            )
        ''')
        
        # Create episode_files table
        cursor.execute('''
            CREATE TABLE episode_files (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                episode_id INTEGER NOT NULL,
                file_path TEXT NOT NULL,
                size INTEGER,
                quality TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (episode_id) REFERENCES episodes(id)
            )
        ''')
        
        # Create settings table
        cursor.execute('''
            CREATE TABLE settings (
                key TEXT PRIMARY KEY,
                value TEXT
            )
        ''')
        
        # Create indexes for performance
        cursor.execute('CREATE INDEX idx_shows_title ON shows(title COLLATE NOCASE)')
        cursor.execute('CREATE INDEX idx_shows_sonarr_id ON shows(sonarr_id)')
        cursor.execute('CREATE INDEX idx_seasons_show_id ON seasons(show_id)')
        cursor.execute('CREATE INDEX idx_episodes_season_id ON episodes(season_id)')
        cursor.execute('CREATE INDEX idx_episodes_sonarr_episode_id ON episodes(sonarr_episode_id)')
        
        # Commit changes
        conn.commit()
        
        logger.info("Database initialized successfully at %s", DB_PATH)
        
    except sqlite3.Error as e:
        logger.error("Error initializing database: %s", str(e))
        raise
    finally:
        if conn:
            conn.close()

# Run initialization if this script is run directly
if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO)
    init_db()
