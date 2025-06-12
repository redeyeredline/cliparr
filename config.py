import logging
import os
from pathlib import Path

# Base paths
BASE_DIR = Path(__file__).resolve().parent
ENV = os.getenv('FLASK_ENV', 'development')

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

# Import mode
try:
    from db.manager import get_setting, set_setting
    IMPORT_MODE = get_setting('import_mode', os.getenv('CLIPARR_IMPORT_MODE', 'none')).lower()
except Exception:
    IMPORT_MODE = os.getenv('CLIPARR_IMPORT_MODE', 'none').lower()

def set_import_mode(new_mode):
    global IMPORT_MODE
    IMPORT_MODE = new_mode.lower()
    os.environ['CLIPARR_IMPORT_MODE'] = new_mode.lower()
    try:
        from db.manager import set_setting
        set_setting('import_mode', new_mode.lower())
    except Exception:
        pass

def configure_logging():
    """Configure logging settings for the application."""
    logging.info("Logging is configured.")
    logging.info(f"Environment: {ENV}")
    logging.info(f"Database path: {DB_PATH}") 