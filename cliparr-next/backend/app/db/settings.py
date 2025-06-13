"""
Settings management for the application.
"""

import sqlite3
import logging
from .constants import DB_PATH

def ensure_settings_table():
    """Ensure the settings table exists."""
    try:
        conn = sqlite3.connect(DB_PATH)
        cur = conn.cursor()
        cur.execute('''
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        conn.commit()
        conn.close()
    except sqlite3.Error as e:
        logging.error("Error ensuring settings table: %s", e)
        raise

def set_import_mode(mode: str) -> None:
    """Set the import mode in the database."""
    try:
        ensure_settings_table()
        conn = sqlite3.connect(DB_PATH)
        cur = conn.cursor()
        cur.execute("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
                   ('import_mode', mode))
        conn.commit()
        conn.close()
        logging.info("Import mode set to: %s", mode)
    except sqlite3.Error as e:
        logging.error("Error setting import mode: %s", e)
        raise

def get_import_mode() -> str:
    """Get the current import mode from the database."""
    try:
        ensure_settings_table()
        conn = sqlite3.connect(DB_PATH)
        cur = conn.cursor()
        cur.execute("SELECT value FROM settings WHERE key = ?", ('import_mode',))
        result = cur.fetchone()
        conn.close()
        return result[0] if result else 'none'
    except sqlite3.Error as e:
        logging.error("Error getting import mode: %s", e)
        return 'none'

def get_setting(key: str, default=None):
    """Get a setting value from the database."""
    try:
        ensure_settings_table()
        conn = sqlite3.connect(DB_PATH)
        cur = conn.cursor()
        cur.execute("SELECT value FROM settings WHERE key = ?", (key,))
        result = cur.fetchone()
        conn.close()
        return result[0] if result else default
    except sqlite3.Error as e:
        logging.error("Error getting setting %s: %s", key, e)
        return default

def set_setting(key: str, value: str) -> None:
    """Set a setting value in the database."""
    try:
        ensure_settings_table()
        conn = sqlite3.connect(DB_PATH)
        cur = conn.cursor()
        cur.execute("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
                   (key, value))
        conn.commit()
        conn.close()
        logging.info("Setting %s set to: %s", key, value)
    except sqlite3.Error as e:
        logging.error("Error setting %s: %s", key, e)
        raise 