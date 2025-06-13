"""
Database-related constants and configuration.
"""

import os
from pathlib import Path

# Base paths
BASE_DIR = Path(__file__).resolve().parent.parent

# Database paths
DB_PATH = os.getenv('DB_PATH', os.path.join('/opt/dockerdata/cliparr', 'cliparr.db'))
if not os.getenv('DB_PATH'):
    DB_PATH = os.path.join(BASE_DIR, 'data', 'cliparr.db')

# Ensure data directory exists
os.makedirs(os.path.dirname(DB_PATH), exist_ok=True) 