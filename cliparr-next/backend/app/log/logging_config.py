"""
This module configures logging for the application, directing log output to the console.
"""

import os
import logging
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Define LOG_DIR to use the mounted /data directory
LOG_DIR = os.getenv('LOG_DIR', '/data/logs')

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
