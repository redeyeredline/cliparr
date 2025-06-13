import logging
import os
from pathlib import Path
import sqlite3
from db.init_db import init_db  # Import the init_db function

# Base paths
BASE_DIR = Path(__file__).resolve().parent
ENV = os.getenv('FLASK_ENV', 'development').lower()

# Export ENV for use in other modules
__all__ = ['BASE_DIR', 'ENV', 'DB_PATH', 'LOG_DIR', 'IMPORT_MODE', 'initialize_database', 'set_import_mode', 'get_import_mode']

# Database configuration
if ENV == 'production':
    DB_PATH = os.getenv('DB_PATH', '/opt/dockerdata/cliparr/db/cliparr.db')
else:
    DB_PATH = os.path.join(BASE_DIR, 'data', 'cliparr.db')

# Ensure data directory exists in development
if ENV == 'development':
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)

# Logging configuration
LOG_DIR = os.getenv('LOG_DIR', os.path.join(BASE_DIR, 'log'))
os.makedirs(LOG_DIR, exist_ok=True)

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
    """
    Ensure the database and necessary tables are created.
    Set default import mode if not already set.
    """
    try:
        # Initialize database tables
        init_db(DB_PATH)
        
        # Connect to the database
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Check if import mode is already set
        cursor.execute('SELECT value FROM settings WHERE key = "import_mode"')
        existing_mode = cursor.fetchone()
        
        if not existing_mode:
            # Set default import mode if not set
            cursor.execute('''
                INSERT OR REPLACE INTO settings (key, value) 
                VALUES ('import_mode', ?)
            ''', (IMPORT_MODE,))
            
            logging.info(f"Set default import mode to: {IMPORT_MODE}")
        
        conn.commit()
    except sqlite3.Error as e:
        logging.error(f"Database initialization error: {e}")
    finally:
        conn.close()

def set_import_mode(mode):
    """
    Set the import mode in the database.
    """
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT OR REPLACE INTO settings (key, value)
            VALUES ('import_mode', ?)
        ''', (mode,))
        
        conn.commit()
        logging.info(f"Import mode set to: {mode}")
    except sqlite3.Error as e:
        logging.error(f"Error setting import mode: {e}")
    finally:
        conn.close()

def get_import_mode():
    """
    Retrieve the current import mode from the database.
    """
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        cursor.execute('SELECT value FROM settings WHERE key = "import_mode"')
        result = cursor.fetchone()
        
        return result[0] if result else IMPORT_MODE
    except sqlite3.Error as e:
        logging.error(f"Error getting import mode: {e}")
        return IMPORT_MODE
    finally:
        conn.close()

# Call this at application startup

