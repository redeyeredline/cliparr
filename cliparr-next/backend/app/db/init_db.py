"""
Database initialization module.
"""

import os
import sqlite3
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

def init_db(db_path: str) -> None:
    """
    Initialize the SQLite database with required tables.
    
    Args:
        db_path: Path to the SQLite database file
    """
    conn = None
    try:
        # Ensure the directory exists
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        
        # Connect to database
        conn = sqlite3.connect(db_path)
        c = conn.cursor()
        
        # Create settings table
        c.execute('''
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Create shows table
        c.execute('''
            CREATE TABLE IF NOT EXISTS shows (
                id INTEGER PRIMARY KEY,
                title TEXT NOT NULL,
                sort_title TEXT,
                status TEXT,
                overview TEXT,
                network TEXT,
                air_time TEXT,
                images TEXT,
                original_language TEXT,
                year INTEGER,
                path TEXT,
                quality_profile_id INTEGER,
                monitored BOOLEAN,
                runtime INTEGER,
                tvdb_id INTEGER,
                tvrage_id INTEGER,
                genres TEXT,
                ratings TEXT,
                statistics TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Create seasons table
        c.execute('''
            CREATE TABLE IF NOT EXISTS seasons (
                id INTEGER PRIMARY KEY,
                show_id INTEGER,
                season_number INTEGER,
                monitored BOOLEAN,
                statistics TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (show_id) REFERENCES shows (id)
            )
        ''')
        
        # Create episodes table
        c.execute('''
            CREATE TABLE IF NOT EXISTS episodes (
                id INTEGER PRIMARY KEY,
                show_id INTEGER,
                season_id INTEGER,
                episode_number INTEGER,
                title TEXT,
                overview TEXT,
                air_date TEXT,
                file_path TEXT,
                file_size INTEGER,
                quality TEXT,
                monitored BOOLEAN,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (show_id) REFERENCES shows (id),
                FOREIGN KEY (season_id) REFERENCES seasons (id)
            )
        ''')
        
        # Create audio_analysis table
        c.execute('''
            CREATE TABLE IF NOT EXISTS audio_analysis (
                id INTEGER PRIMARY KEY,
                episode_id INTEGER,
                analysis_data TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (episode_id) REFERENCES episodes (id)
            )
        ''')
        
        # Insert default settings if they don't exist
        c.execute('''
            INSERT OR IGNORE INTO settings (key, value) 
            VALUES ('import_mode', 'none')
        ''')
        
        conn.commit()
        logger.info("Database initialized successfully")
        
    except sqlite3.Error as e:
        logger.error(f"Error initializing database: {str(e)}")
        raise
    except Exception as e:
        logger.error(f"Unexpected error initializing database: {str(e)}")
        raise
    finally:
        if conn:
            conn.close()

# Run initialization if this script is run directly
if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO)
    init_db()
