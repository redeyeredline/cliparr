"""
This module handles the integration with the Sonarr API to fetch and store TV series information.
It includes endpoints for scanning shows, fetching show details, and importing data from Sonarr.
"""

# Standard library imports
import asyncio
import datetime
import logging
import os
import platform
import sqlite3
import sys
import time
import traceback
from contextlib import asynccontextmanager
from typing import List, Dict, Optional

# Third-party imports
import fastapi
from dotenv import load_dotenv
from fastapi import FastAPI, Request, HTTPException, Depends, BackgroundTasks, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
import hypercorn.asyncio
import socketio
import uvicorn
from fastapi.templating import Jinja2Templates
from fastapi.websockets import WebSocketState
import json
import requests

# Local imports
from .config import (
    DB_PATH,
    LOG_DIR,
    CONFIG_DIR,
    SONARR_URL,
    SONARR_API_KEY,
    TIMEOUT,
    IMPORT_MODE,
    ENV,
    DEBUG,
    HOST,
    PORT,
    CLIPARR_IMPORT_MODE
)
from .db.settings import set_import_mode, get_import_mode, ensure_settings_table
from .db.manager import (
    get_db,
    insert_show,
    insert_season,
    insert_episode,
    process_show_data,
    store_data_in_db,
    get_imported_shows_optimized
)
from .api.sonarr_api import fetch_series_data, fetch_json
from .log.logging_config import configure_logging
from .media.audio_analysis_jobs import AudioAnalysisJobManager
from .db.init_db import init_db

load_dotenv()

# Configure logging
configure_logging()
logger = logging.getLogger(__name__)

# Debug: Print environment and paths
logger.info("Environment: %s", ENV)
logger.info("DB_PATH: %s", DB_PATH)
logger.info("LOG_DIR: %s", LOG_DIR)
logger.info("CONFIG_DIR: %s", CONFIG_DIR)

# Debug: Check if directories exist
for path in [os.path.dirname(DB_PATH), LOG_DIR, CONFIG_DIR]:
    logger.info("Checking directory: %s", path)
    if os.path.exists(path):
        logger.info("Directory exists: %s", path)
    else:
        logger.info("Directory does not exist: %s", path)

# Initialize FastAPI with performance optimizations
app = FastAPI(
    title="Cliparr",
    description="Media Management Application",
    version="0.1.0",
    docs_url=None if not DEBUG else "/docs",
    redoc_url=None if not DEBUG else "/redoc"
)

# Add performance middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Initialize audio analysis job manager
audio_job_manager = AudioAnalysisJobManager()

# Global flag to control background task
background_task_running = False
background_task_thread = None

# Define static directory based on environment
STATIC_DIR = "/data/static" if ENV == "production" else os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "frontend", "dist")

# Ensure static directory exists
os.makedirs(STATIC_DIR, exist_ok=True)

# Mount static files at /static instead of root
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

# Ensure logging outputs to console
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')

# Log all registered routes at startup
def log_routes(app):
    logger.info('Registered routes:')
    for route in app.routes:
        if hasattr(route, 'methods'):
            logger.info(f"{route.path} [{','.join(route.methods)}]")
        elif hasattr(route, 'name'):
            logger.info(f"{route.path} [{route.name}]")
        else:
            logger.info(f"{route.path}")

log_routes(app)

# Define all API routes using @app
@app.get('/api/health')
async def health_check():
    logger.info('GET /api/health called')
    return {"status": "ok"}

@app.get('/api/sonarr/unimported')
async def get_unimported_shows():
    logger.info('GET /api/sonarr/unimported called')
    try:
        sonarr_shows = fetch_series_data()
        if not sonarr_shows:
            logger.warning("No shows returned from Sonarr API")
            return []
            
        db = get_db()
        cursor = db.cursor()
        cursor.execute('SELECT sonarr_id FROM shows')
        imported_ids = {row[0] for row in cursor.fetchall()}
        unimported = [show for show in sonarr_shows if show['id'] not in imported_ids]
        logger.info(f"Returning {len(unimported)} unimported shows")
        return unimported
    except requests.exceptions.RequestException as e:
        logger.error("Error connecting to Sonarr API: %s", str(e))
        raise HTTPException(status_code=503, detail="Unable to connect to Sonarr API")
    except Exception as e:
        logger.error("Error fetching unimported shows: %s", str(e))
        raise HTTPException(status_code=500, detail=str(e))

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan manager for startup and shutdown events.
    """
    try:
        # Initialize database
        logger.info("Initializing database...")
        init_db()
        
        # Verify Sonarr connection
        logger.info("Verifying Sonarr connection...")
        try:
            fetch_series_data()
            logger.info("Successfully connected to Sonarr")
        except Exception as e:
            logger.error("Failed to connect to Sonarr: %s", str(e))
            raise
        
        # Ensure settings table exists and set initial import mode
        ensure_settings_table()
        set_import_mode(IMPORT_MODE)

        # Start background task based on import mode
        if IMPORT_MODE in ("auto", "import"):
            try:
                start_background_task()
            except Exception as e:
                logging.error(f"Failed to start background task: {e}")
        else:
            logging.info("Background task not started due to import mode")
        
        yield
    finally:
        # Cleanup on shutdown
        logger.info("Shutting down application...")
        global background_task_running
        background_task_running = False
        stop_background_task()

# Set the lifespan context manager
app.router.lifespan_context = lifespan

def start_background_task():
    global background_task_running, background_task_thread
    if not background_task_running:
        background_task_running = True
        # Use asyncio to run the background task
        asyncio.create_task(background_import_task())

def stop_background_task():
    global background_task_running
    background_task_running = False

async def background_import_task():
    """
    Background task for automatic import and scanning.
    """
    global background_task_running
    while background_task_running:
        try:
            # Use the current import mode from the database
            current_mode = get_import_mode()
            if current_mode == 'auto':
                logging.info("Running auto import scan...")
                sonarr_shows = fetch_series_data()
                db = get_db()
                cur = db.cursor()
                # Existing import logic remains the same
                for show in sonarr_shows:
                    episodes = fetch_json(f'episode?seriesId={show["id"]}')
                    cur.execute('SELECT s.id FROM shows s WHERE s.sonarr_id = ?', (show['id'],))
                    show_row = cur.fetchone()
                    if show_row:
                        local_show_id = show_row[0]
                        cur.execute('SELECT e.sonarr_episode_id FROM episodes e JOIN seasons s ON e.season_id = s.id WHERE s.show_id = ?', (local_show_id,))
                        imported_episode_ids = set(row[0] for row in cur.fetchall())
                    else:
                        local_show_id = insert_show(cur, show)
                        imported_episode_ids = set()

                    missing_episodes = [ep for ep in episodes if ep['id'] not in imported_episode_ids]

                    if missing_episodes:
                        for ep in missing_episodes:
                            season_number = ep['seasonNumber']
                            season_id = insert_season(cur, local_show_id, season_number)
                            insert_episode(cur, season_id, ep)

                db.commit()

                # Use async emit for WebSocket
                await sio.emit('show_imported', {'status': 'scan_complete'})

            elif current_mode == 'import':
                # Handle import mode - only scan imported shows
                logging.info("Running import mode scan...")
                db = get_db()
                cur = db.cursor()
                cur.execute('SELECT sonarr_id FROM shows')
                imported_sonarr_ids = [row[0] for row in cur.fetchall()]

                for sonarr_id in imported_sonarr_ids:
                    episodes = fetch_json(f'episode?seriesId={sonarr_id}')
                    cur.execute('SELECT s.id FROM shows s WHERE s.sonarr_id = ?', (sonarr_id,))
                    show_row = cur.fetchone()

                    if show_row:
                        local_show_id = show_row[0]
                        cur.execute('SELECT e.sonarr_episode_id FROM episodes e JOIN seasons s ON e.season_id = s.id WHERE s.show_id = ?', (local_show_id,))
                        imported_episode_ids = set(row[0] for row in cur.fetchall())
                        missing_episodes = [ep for ep in episodes if ep['id'] not in imported_episode_ids]

                        if missing_episodes:
                            for ep in missing_episodes:
                                season_number = ep['seasonNumber']
                                season_id = insert_season(cur, local_show_id, season_number)
                                insert_episode(cur, season_id, ep)
                    db.commit()
                                # Use async emit for WebSocket
                await sio.emit('show_imported', {'status': 'scan_complete'})

            await asyncio.sleep(300)  # Sleep for 5 minutes between scans

        except Exception as e:
            logging.error(f"Error in background import task: {e}")
            await asyncio.sleep(300)  # Sleep even on error to prevent rapid retries

def log_performance(func):
    async def wrapper(*args, **kwargs):
        start_time = time.time()
        try:
            result = await func(*args, **kwargs)
            end_time = time.time()
            logging.info(f"Performance: {func.__name__} took {(end_time - start_time) * 1000:.2f} ms")
            return result
        except Exception as e:
            logging.error(f"Error in {func.__name__}: {e}")
            raise
    return wrapper

@log_performance
async def get_imported_shows(page: Optional[int] = 1, page_size: Optional[int] = 100):
    """
    Retrieve paginated list of imported shows with comprehensive error handling.
    
    :param page: Page number (default: 1)
    :param page_size: Number of shows per page (default: 100)
    :return: Paginated list of imported shows
    """
    # Ensure page and page_size are positive integers
    page = max(1, page or 1)
    page_size = max(1, page_size or 100)

    conn = None
    try:
        # Detailed logging for database connection
        logging.info(f"Attempting to connect to database at {DB_PATH}")

        # Validate database path
        if not os.path.exists(DB_PATH):
            logging.error(f"Database file does not exist: {DB_PATH}")
            return {
                "error": "Database file not found",
                "details": f"Path: {DB_PATH}",
                "shows": [],
                "total": 0,
                "page": page,
                "page_size": page_size,
                "total_pages": 0
            }

        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row  # Enable dictionary-like access
        cursor = conn.cursor()

        # Comprehensive database diagnostics
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = cursor.fetchall()
        logging.info(f"Existing tables: {[table[0] for table in tables]}")

# Validate shows table exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='shows'")
        shows_table_exists = cursor.fetchone() is not None

        if not shows_table_exists:
            logging.warning("Shows table does not exist. Attempting to create.")
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS shows (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT NOT NULL,
                    sonarr_id INTEGER UNIQUE,
                    path TEXT
                )
            ''')
            conn.commit()

        # Performance tracking for count query
        count_start = time.time()
        cursor.execute('SELECT COUNT(*) FROM shows')
        total_shows = cursor.fetchone()[0]
        count_duration = time.time() - count_start
        logging.info(f"Count query took {count_duration * 1000:.2f} ms")

        # Calculate total pages
        total_pages = max(1, (total_shows + page_size - 1) // page_size)

        # Ensure page is within valid range
        page = min(page, total_pages)

        # Calculate offset
        offset = (page - 1) * page_size

        # Performance tracking for fetch query
        fetch_start = time.time()
        cursor.execute('''
            SELECT id, title, sonarr_id, path 
            FROM shows 
            ORDER BY title 
            LIMIT ? OFFSET ?
        ''', (page_size, offset))

        shows_rows = cursor.fetchall()
        fetch_duration = time.time() - fetch_start
        logging.info(f"Fetch query took {fetch_duration * 1000:.2f} ms")

        shows = []
        for row in shows_rows:
            try:
                show = {
                    'id': row['id'],
                    'title': row['title'],
                    'sonarr_id': row['sonarr_id'],
                    'path': row['path']
                }

                # Fetch season and episode count
                season_stats_start = time.time()
                cursor.execute('''
                    SELECT 
                        COUNT(DISTINCT s.id) as season_count,
                        COUNT(e.id) as episode_count
                    FROM seasons s
                    LEFT JOIN episodes e ON e.season_id = s.id
                    WHERE s.show_id = ?
                ''', (row['id'],))

                season_stats = cursor.fetchone()
                season_stats_duration = time.time() - season_stats_start
                logging.info(f"Season stats query took {season_stats_duration * 1000:.2f} ms")

                show['seasons_count'] = season_stats[0] if season_stats else 0
                show['episodes_count'] = season_stats[1] if season_stats else 0

                shows.append(show)
            except Exception as row_error:
                logging.error(f"Error processing show row: {row_error}", exc_info=True)

        # Comprehensive response logging
        response = {
            "shows": shows,
            "total": total_shows,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages,
            "performance": {
                "count_query_ms": count_duration * 1000,
                "fetch_query_ms": fetch_duration * 1000,
                "season_stats_query_ms": season_stats_duration * 1000
            }
        }

        logging.info(f"Returning {len(shows)} shows out of {total_shows}")

        return response

    except sqlite3.Error as e:
        logging.error(f"SQLite error fetching imported shows: {e}", exc_info=True)
        return {
            "error": f"Database error: {str(e)}",
            "error_type": "sqlite_error",
            "shows": [],
            "total": 0,
            "page": page,
            "page_size": page_size,
            "total_pages": 0
        }
    except Exception as e:
        logging.error(f"Unexpected error fetching imported shows: {e}", exc_info=True)
        return {
            "error": f"Unexpected error: {str(e)}",
            "error_type": "unexpected_error",
            "shows": [],
            "total": 0,
            "page": page,
            "page_size": page_size,
            "total_pages": 0
        }
    finally:
        if conn:
            conn.close()

@app.post('/api/sonarr/import')
async def import_selected_shows(request: Request):
    logger.info('POST /api/sonarr/import called')
    try:
        data = await request.json()
        show_ids = data.get('showIds', [])
        logger.info(f"Importing shows: {show_ids}")
        if not show_ids:
            raise HTTPException(status_code=400, detail="No show IDs provided")
        sonarr_shows = fetch_series_data()
        shows_to_import = [show for show in sonarr_shows if show['id'] in show_ids]
        if not shows_to_import:
            raise HTTPException(status_code=404, detail="No matching shows found")
        db = get_db()
        cur = db.cursor()
        imported_shows = []
        for show in shows_to_import:
            try:
                episodes = fetch_json(f'episode?seriesId={show["id"]}')
                cur.execute(
                    'INSERT OR REPLACE INTO shows (sonarr_id, title, overview, path) VALUES (?, ?, ?, ?)',
                    (show['id'], show.get('title', ''), show.get('overview', ''), show.get('path', ''))
                )
                show_id = cur.lastrowid or cur.execute('SELECT id FROM shows WHERE sonarr_id = ?', (show['id'],)).fetchone()[0]
                for ep in episodes:
                    season_number = ep['seasonNumber']
                    cur.execute(
                        'INSERT OR REPLACE INTO seasons (show_id, season_number) VALUES (?, ?)',
                        (show_id, season_number)
                    )
                    season_id = cur.lastrowid or cur.execute(
                        'SELECT id FROM seasons WHERE show_id = ? AND season_number = ?',
                        (show_id, season_number)
                    ).fetchone()[0]
                    cur.execute(
                        'INSERT OR REPLACE INTO episodes (season_id, episode_number, title, sonarr_episode_id) VALUES (?, ?, ?, ?)',
                        (season_id, ep['episodeNumber'], ep.get('title', ''), ep['id'])
                    )
                imported_shows.append({
                    'id': show['id'],
                    'title': show['title'],
                    'episodesImported': len(episodes)
                })
            except Exception as e:
                logger.error("Error importing show %s: %s", show['title'], str(e))
                continue
        db.commit()
        logger.info(f"Successfully imported {len(imported_shows)} shows")
        return {
            "importedCount": len(imported_shows),
            "importedShows": imported_shows
        }
    except Exception as e:
        logger.error("Error importing shows: %s", str(e))
        raise HTTPException(status_code=500, detail=str(e))

@app.post('/api/imported-shows')
async def delete_imported_shows(request: Request):
    logger.info('POST /api/imported-shows called')
    try:
        data = await request.json()
        show_ids = data.get('showIds', [])
        logger.info(f"Deleting shows: {show_ids}")
        if not show_ids:
            logging.error("No show IDs provided for deletion")
            return {"error": "No show IDs provided"}
        db = get_db()
        cursor = db.cursor()
        cursor.execute(
            f'SELECT e.id FROM episodes e JOIN seasons s ON e.season_id = s.id WHERE s.show_id IN ({",".join("?" * len(show_ids))})',
            show_ids
        )
        episode_ids = [row[0] for row in cursor.fetchall()]
        logger.info(f"Found {len(episode_ids)} episodes to delete")
        if episode_ids:
            placeholders = ','.join(['?' for _ in episode_ids])
            cursor.execute(f'DELETE FROM episode_files WHERE episode_id IN ({placeholders})', episode_ids)
            logger.info(f"Deleted episode files for {len(episode_ids)} episodes")
        cursor.execute(
            f'DELETE FROM episodes WHERE season_id IN (SELECT id FROM seasons WHERE show_id IN ({",".join("?" * len(show_ids))}))',
            show_ids
        )
        logger.info(f"Deleted episodes for shows {show_ids}")
        cursor.execute(
            f'DELETE FROM seasons WHERE show_id IN ({",".join("?" * len(show_ids))})',
            show_ids
        )
        logger.info(f"Deleted seasons for shows {show_ids}")
        cursor.execute(
            f'DELETE FROM shows WHERE id IN ({",".join("?" * len(show_ids))})',
            show_ids
        )
        logger.info(f"Deleted shows {show_ids}")
        db.commit()
        logger.info("Successfully committed all deletions")
        return {"status": "success"}
    except sqlite3.Error as e:
        logger.error(f"Database error while deleting shows: {e}")
        return {"error": f"Error deleting shows: {e}"}
    except Exception as e:
        logger.error(f"Unexpected error while deleting shows: {e}")
        return {"error": f"Unexpected error: {e}"}

@app.get('/api/series/{show_id}')
async def api_get_series(show_id: int):
    logger.info(f'GET /api/series/{show_id} called')
    db = get_db()
    cursor = db.cursor()
    cursor.execute('SELECT id, title, overview, path FROM shows WHERE id = ?', (show_id,))
    show = cursor.fetchone()
    if not show:
        logger.info(f'Show {show_id} not found')
        return {"error": "Show not found"}
    cursor.execute('SELECT id, season_number FROM seasons WHERE show_id = ? ORDER BY season_number', (show_id,))
    seasons = cursor.fetchall()
    season_list = []
    for season in seasons:
        season_id, season_number = season['id'], season['season_number']
        cursor.execute('SELECT episode_number, title FROM episodes WHERE season_id = ? ORDER BY episode_number', (season_id,))
        episodes = [{'episodeNumber': ep['episode_number'], 'title': ep['title']} for ep in cursor.fetchall()]
        season_list.append({
            'seasonNumber': season_number,
            'episodes': episodes
        })
    logger.info(f'Returning series info for show {show_id}')
    return {
        'id': show['id'],
        'title': show['title'],
        'overview': show['overview'],
        'path': show['path'],
        'seasons': season_list
    }

@app.get('/api/settings/import-mode')
async def get_import_mode():
    logger.info('GET /api/settings/import-mode called')
    from app.config import IMPORT_MODE
    return {"mode": IMPORT_MODE}

@app.post('/api/settings/import-mode')
async def update_import_mode(request: Request):
    logger.info('POST /api/settings/import-mode called')
    data = await request.json()
    mode = data.get('mode', 'none').lower()
    logger.info(f"Setting import mode to: {mode}")
    if mode not in ('auto', 'import', 'none'):
        return {"error": "Invalid mode"}
    try:
        set_import_mode(mode)
        logging.info(f"Import mode set to: {mode}")
        if mode in ('auto', 'import'):
            start_background_task()
        return {"status": "success", "mode": mode}
    except Exception as e:
        logger.error(f"Error updating import mode: {e}")
        return {"error": str(e)}

@app.get('/api/audio-analysis/jobs')
async def get_audio_analysis_jobs(
    status: Optional[str] = None,
    limit: int = 100,
    offset: int = 0
) -> List[Dict]:
    logger.info('GET /api/audio-analysis/jobs called')
    return audio_job_manager.get_jobs(status, limit, offset)

@app.post('/api/audio-analysis/schedule')
async def schedule_audio_analysis(
    show_id: int,
    show_title: str,
    episodes: List[Dict]
) -> Dict:
    logger.info('POST /api/audio-analysis/schedule called')
    try:
        job_id = audio_job_manager.schedule_job(show_id, show_title, episodes)
        logger.info(f"Scheduled audio analysis job {job_id}")
        return {"status": "success", "job_id": job_id}
    except Exception as e:
        logger.error(f"Error scheduling audio analysis: {e}")
        return {"error": str(e)}

@app.post('/api/audio-analysis/cleanup')
async def cleanup_audio_analysis_jobs(days: int = 30) -> Dict:
    logger.info('POST /api/audio-analysis/cleanup called')
    try:
        cleaned = audio_job_manager.cleanup_old_jobs(days)
        logger.info(f"Cleaned up {cleaned} audio analysis jobs older than {days} days")
        return {"status": "success", "cleaned": cleaned}
    except Exception as e:
        logger.error(f"Error cleaning up jobs: {e}")
        return {"error": str(e)}

@app.get('/api/websocket-test')
async def websocket_test():
    logger.info('GET /api/websocket-test called')
    return {"status": "WebSocket server is running"}

# Add a catch-all route for the frontend
@app.get("/{path:path}")
async def serve_frontend(path: str):
    if path.startswith("api/"):
        raise HTTPException(status_code=404, detail="API endpoint not found")
    return FileResponse(os.path.join(STATIC_DIR, "index.html"))

# Configure socket.io with performance settings
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins=["*"],
    ping_timeout=30,
    ping_interval=60,
    logger=DEBUG,
    engineio_logger=DEBUG,
    max_http_buffer_size=1024 * 1024,
    async_handlers=True,
    cors_credentials=True
)

# Create the ASGI app after all routes are defined
socket_app = socketio.ASGIApp(sio, app, socketio_path='/socket.io')

# WebSocket event handlers
@sio.on('connect')
async def connect(sid, environ):
    logger.info(f"WebSocket client connected: {sid}")
    try:
        # Send minimal connection confirmation
        await sio.emit('connection_status', {
            'status': 'connected', 
            'timestamp': int(time.time() * 1000)
        }, room=sid)
    except Exception as e:
        logger.error(f"WebSocket connection error: {e}")

@sio.on('disconnect')
async def disconnect(sid):
    logger.info(f"WebSocket client disconnected: {sid}")

@sio.on('connect_error')
async def connect_error(error):
    logger.error(f"WebSocket connection error: {error}", exc_info=True)

@sio.on('test_event')
async def handle_test_event(sid, data):
    """
    Comprehensive test event handler for diagnostics.
    """
    try:
        # Validate incoming data
        if not isinstance(data, dict):
            logging.warning(f"Invalid test_event data type: {type(data)}")
            await sio.emit('test_event_response', {
                'status': 'error', 
                'error': 'Invalid data format',
                'received_data_type': str(type(data))
            }, room=sid)
            return

        client_timestamp = data.get('timestamp')
        if not isinstance(client_timestamp, (int, float)):
            logging.warning(f"Invalid timestamp: {client_timestamp}")
            await sio.emit('test_event_response', {
                'status': 'error', 
                'error': 'Invalid timestamp',
                'received_timestamp': client_timestamp
            }, room=sid)
            return

        # Comprehensive response with additional diagnostics
        await sio.emit('test_event_response', {
            'status': 'success', 
            'serverTimestamp': int(time.time() * 1000),
            'clientTimestamp': client_timestamp,
            'serverInfo': {
                'python_version': platform.python_version(),
                'os_name': platform.system(),
                'os_version': platform.release(),
                'server_time': datetime.now().isoformat()
            }
        }, room=sid)
    except Exception as e:
        logging.error(f"Error handling test event: {e}", exc_info=True)
        await sio.emit('test_event_response', {
            'status': 'error', 
            'error': str(e),
            'details': traceback.format_exc()
        }, room=sid)

# To run: uvicorn app:socket_app --host 0.0.0.0 --port 5000

if __name__ == '__main__':
    try:
        import hypercorn.asyncio
        import hypercorn.config
        import asyncio
        config = hypercorn.config.Config()
        config.bind = ["0.0.0.0:5000"]
        asyncio.run(hypercorn.asyncio.serve(socket_app, config))
    except ImportError:
        import uvicorn
        uvicorn.run(socket_app, host="0.0.0.0", port=5000)
    