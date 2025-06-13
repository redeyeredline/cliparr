"""
Database-related constants and configuration.
"""

import os
from pathlib import Path

# Base paths
BASE_DIR = Path(__file__).resolve().parent.parent

# Database paths
DATA_DIR = os.getenv('CLIPARR_DATA_DIR', '/data')
DB_DIR = os.path.join(DATA_DIR, 'db')
DB_PATH = os.getenv('DB_PATH', os.path.join(DB_DIR, 'cliparr.db'))

# Ensure data directory exists
os.makedirs(os.path.dirname(DB_PATH), exist_ok=True) 