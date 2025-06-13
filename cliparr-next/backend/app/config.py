"""
Configuration settings for the application.
"""

import os
import logging
from pathlib import Path
from .db.constants import DB_PATH

# Base paths
BASE_DIR = Path(__file__).resolve().parent

# Environment
ENV = os.getenv('ENV', 'production')
DEBUG = os.getenv('DEBUG', 'false').lower() == 'true'

# Server configuration
HOST = os.getenv('HOST', '0.0.0.0')
PORT = int(os.getenv('PORT', '5000'))

# Import mode configuration
CLIPARR_IMPORT_MODE = os.getenv('CLIPARR_IMPORT_MODE', 'none')
IMPORT_MODE = CLIPARR_IMPORT_MODE  # Alias for backward compatibility

# Logging configuration
LOG_DIR = os.getenv('LOG_DIR', os.path.join('/config', 'log'))
if not os.getenv('LOG_DIR'):
    LOG_DIR = os.path.join(BASE_DIR, 'log')

# Config directory
CONFIG_DIR = os.getenv('CONFIG_DIR', os.path.join('/config'))
if not os.getenv('CONFIG_DIR'):
    CONFIG_DIR = os.path.join(BASE_DIR, 'config')

# Ensure directories exist
for directory in [os.path.dirname(DB_PATH), LOG_DIR, CONFIG_DIR]:
    os.makedirs(directory, exist_ok=True)

# Sonarr configuration
SONARR_URL = os.getenv('SONARR_URL', 'localhost:8989')
SONARR_API_KEY = os.getenv('SONARR_API_KEY', '')
TIMEOUT = int(os.getenv('TIMEOUT', '10'))

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(os.path.join(LOG_DIR, 'app.log'))
    ]
)

# Initialize database
from .db.init_db import init_db
init_db(DB_PATH)

__all__ = [
    'DB_PATH', 'LOG_DIR', 'CONFIG_DIR', 'SONARR_URL', 
    'SONARR_API_KEY', 'TIMEOUT', 'IMPORT_MODE', 'ENV', 'DEBUG',
    'HOST', 'PORT', 'CLIPARR_IMPORT_MODE'
]
