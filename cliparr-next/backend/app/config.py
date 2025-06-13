import logging
import os
from pathlib import Path
import sqlite3
from .db.init_db import init_db  # Import the init_db function

# Base paths
BASE_DIR = Path(__file__).resolve().parent
ENV = os.getenv('FLASK_ENV', 'development').lower()

# Export ENV for use in other modules
__all__ = ['BASE_DIR', 'ENV', 'DB_PATH', 'LOG_DIR', 'IMPORT_MODE', 'initialize_database', 'set_import_mode', 'get_import_mode']

# Database configuration
if ENV == 'production':
    DB_PATH = os.path.join('/data', 'cliparr.db')
    LOG_DIR = os.path.join('/config', 'log')
    CONFIG_DIR = '/config'
else:
    DB_PATH = os.path.join(BASE_DIR, 'data', 'cliparr.db')
    LOG_DIR = os.path.join(BASE_DIR, 'log')
    CONFIG_DIR = os.path.join(BASE_DIR, 'config')

# Ensure directories exist
for directory in [os.path.dirname(DB_PATH), LOG_DIR, CONFIG_DIR]:
    os.makedirs(directory, exist_ok=True)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(os.path.join(LOG_DIR, 'app.log')),
        logging.StreamHandler()
    ]
)

# Import mode - initialize from environment variable
IMPORT_MODE = os.getenv('CLIPARR_IMPORT_MODE', 'none').lower()

def initialize_database():
    """Initialize the database with the required tables."""
    try:
        # Initialize database with the correct path
        init_db(DB_PATH)
        logging.info("Database initialized successfully at %s", DB_PATH)
    except sqlite3.Error as e:
        logging.error("Error initializing database: %s", e)
        raise

def set_import_mode(mode):
    """Set the import mode in the database."""
    try:
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

def get_import_mode():
    """Get the current import mode from the database."""
    try:
        conn = sqlite3.connect(DB_PATH)
        cur = conn.cursor()
        cur.execute("SELECT value FROM settings WHERE key = ?", ('import_mode',))
        result = cur.fetchone()
        conn.close()
        return result[0] if result else 'none'
    except sqlite3.Error as e:
        logging.error("Error getting import mode: %s", e)
        return 'none'

# Call this at application startup
