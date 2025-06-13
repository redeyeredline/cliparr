
import os
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Define data and temp directories
DATA_DIR = os.getenv('CLIPARR_DATA_DIR', '/app/data')
TEMP_DIR = os.getenv('CLIPARR_TEMP_DIR', '/app/temp')

# Ensure directories exist
os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(TEMP_DIR, exist_ok=True)

# Log startup
logger.info("Starting FastAPI app")

# Log database initialization
logger.info("Initializing database")

# Log Sonarr API initialization
logger.info("Initializing Sonarr API")

# Log audio analysis thread start
logger.info("Starting audio analysis thread")

# Log shutdown
logger.info("Shutting down FastAPI app")
