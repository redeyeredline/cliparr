import logging
import os
from pathlib import Path

# Base paths
BASE_DIR = Path(__file__).resolve().parent
ENV = os.getenv('FLASK_ENV', 'development')

# Database configuration
if ENV == 'production':
    DB_PATH = os.getenv('DB_PATH', '/opt/dockerdata/cliprr/db/cliprr.db')
else:
    DB_PATH = os.path.join(BASE_DIR, 'data', 'cliprr.db')

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

def configure_logging():
    """Configure logging settings for the application."""
    logging.info("Logging is configured.")
    logging.info(f"Environment: {ENV}")
    logging.info(f"Database path: {DB_PATH}") 