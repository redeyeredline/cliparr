"""
This module configures logging for the application, directing log output to the console.
"""

import os
import logging
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Define LOG_DIR here, do NOT import from app.py
LOG_DIR = os.getenv('LOG_DIR', os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'log'))

def configure_logging():
    """Configure logging to output to console and file."""
    # Ensure log directory exists
    os.makedirs(LOG_DIR, exist_ok=True)
    
    # Configure logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s',
        handlers=[
            logging.StreamHandler(),
            logging.FileHandler(os.path.join(LOG_DIR, 'app.log'))
        ]
    )
    logging.info("Logging configured. Log directory: %s", LOG_DIR)

# Only call this if you want logging configured on import
# configure_logging()
