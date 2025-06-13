"""
Configuration settings for the application.
"""

import os
import logging
from pathlib import Path

# Base paths
BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = os.getenv('CLIPARR_DATA_DIR', '/data')
DB_DIR = os.path.join(DATA_DIR, 'db')

# Database paths
DB_PATH = os.path.join(DB_DIR, 'cliparr.db')
AUDIO_FINGERPRINTS_DB = os.path.join(DB_DIR, 'audio_fingerprints.db')
AUDIO_ANALYSIS_JOBS_DB = os.path.join(DB_DIR, 'audio_analysis_jobs.db')

# Logging and config directories
LOG_DIR = os.path.join(DATA_DIR, 'logs')
CONFIG_DIR = os.path.join(DATA_DIR, 'config')
MEDIA_DIR = os.path.join(DATA_DIR, 'media')

# Ensure directories exist
os.makedirs(DB_DIR, exist_ok=True)
os.makedirs(LOG_DIR, exist_ok=True)
os.makedirs(CONFIG_DIR, exist_ok=True)
os.makedirs(MEDIA_DIR, exist_ok=True)

# Environment variables with defaults
ENV = os.getenv('ENV', 'development')
DEBUG = os.getenv('DEBUG', 'true').lower() == 'true'
HOST = os.getenv('HOST', '0.0.0.0')
PORT = int(os.getenv('PORT', '5000'))
CLIPARR_IMPORT_MODE = os.getenv('CLIPARR_IMPORT_MODE', 'none')
IMPORT_MODE = CLIPARR_IMPORT_MODE  # Alias for backward compatibility

# Sonarr API settings
SONARR_URL = os.getenv('SONARR_URL', 'http://localhost:8989')
SONARR_API_KEY = os.getenv('SONARR_API_KEY', '')

# Timeout settings
TIMEOUT = 30  # seconds

# Configure logging
logging.basicConfig(
    level=logging.DEBUG if DEBUG else logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

__all__ = [
    'DB_PATH', 'AUDIO_FINGERPRINTS_DB', 'AUDIO_ANALYSIS_JOBS_DB',
    'DATA_DIR', 'DB_DIR', 'LOG_DIR', 'CONFIG_DIR', 'MEDIA_DIR', 
    'SONARR_URL', 'SONARR_API_KEY', 'TIMEOUT', 'CLIPARR_IMPORT_MODE', 
    'IMPORT_MODE', 'ENV', 'DEBUG', 'HOST', 'PORT'
]
